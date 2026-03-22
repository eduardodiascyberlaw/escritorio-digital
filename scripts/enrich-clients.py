#!/usr/bin/env python3
"""
Script para enriquecer dados de clientes no CRM AG.
Lê PDFs e DOCX das pastas do Google Drive, extrai dados com Gemini,
e actualiza clientes/casos no CRM.

Uso: python3 scripts/enrich-clients.py [--dry-run] [--execute]
"""

import os
import sys
import json
import time
import re
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Instalar: pip3 install pymupdf")
    sys.exit(1)

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

CRM_API = "https://plataforma-crm-juridico.klx2s6.easypanel.host"
DRIVE_BASE = "/Users/eduardodias/Library/CloudStorage/GoogleDrive-eduardodias@eduardodiasadvogado.com/O meu disco/PASTA CLIENTES AÇÕES"
DRY_RUN = "--execute" not in sys.argv

# ─────────────────────────────────────────────
# CRM helpers
# ─────────────────────────────────────────────

def _ssl_context():
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

def crm_login():
    import urllib.request
    req = urllib.request.Request(
        f"{CRM_API}/api/auth/login",
        data=json.dumps({"email": "admin@escritorio.pt", "password": "Mariana123mudar#"}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, context=_ssl_context()) as resp:
        data = json.loads(resp.read())
    return data["data"]["accessToken"]


def crm_get(path, token):
    import urllib.request
    req = urllib.request.Request(
        f"{CRM_API}{path}",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req, context=_ssl_context()) as resp:
        return json.loads(resp.read())


def crm_patch(path, token, body):
    import urllib.request
    req = urllib.request.Request(
        f"{CRM_API}{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req, context=_ssl_context()) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"    PATCH error: {e}")
        return None


# ─────────────────────────────────────────────
# PDF extraction
# ─────────────────────────────────────────────

def extract_pdf_text(filepath, max_pages=5):
    """Extract text from first N pages of a PDF."""
    try:
        doc = fitz.open(filepath)
        text = ""
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            text += page.get_text()
        doc.close()
        return text[:5000]  # Cap at 5000 chars
    except Exception as e:
        return f"[Erro ao ler PDF: {e}]"


def extract_docx_text(filepath):
    """Basic DOCX text extraction via XML parsing."""
    import zipfile
    import xml.etree.ElementTree as ET

    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            with z.open('word/document.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
                texts = []
                for elem in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'):
                    if elem.text:
                        texts.append(elem.text)
                return " ".join(texts)[:5000]
    except Exception as e:
        return f"[Erro ao ler DOCX: {e}]"


# ─────────────────────────────────────────────
# Pattern extraction (no LLM needed for structured data)
# ─────────────────────────────────────────────

def extract_data_from_text(text):
    """Extract structured data from document text using regex patterns."""
    data = {}

    # Processo number (Citius format: NNNN/NN.NXXXXXX)
    proc = re.search(r'(\d{1,5}/\d{2}\.\d[A-Z0-9]+)', text)
    if proc:
        data["numero_processo"] = proc.group(1)

    # Tribunal / Juízo
    tribunal_patterns = [
        r'(Ju[íi]zo\s+(?:do\s+)?(?:Trabalho|Local\s+C[íi]vel|Central\s+C[íi]vel|Administrativo|Fam[íi]lia)[^,\n]{0,80})',
        r'(Tribunal\s+(?:Administrativo|Judicial|da\s+Rela[çc][ãa]o|de\s+Com[ée]rcio)[^,\n]{0,80})',
        r'(TAF\s+[A-Za-zÀ-ú\s]+)',
    ]
    for pat in tribunal_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            data["tribunal"] = m.group(1).strip()
            break

    # Judge name
    juiz = re.search(r'(?:Ju[íi](?:z|za)\s*(?:\d+)?[\s:]+|Meritíssim[oa]\s+)([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})', text)
    if juiz:
        data["juiz"] = juiz.group(1).strip()

    # NIF (9 digits)
    nif = re.search(r'(?:NIF|N\.I\.F\.?|contribuinte)[:\s]*(\d{9})', text, re.IGNORECASE)
    if nif:
        data["nif"] = nif.group(1)

    # NISS (11 digits)
    niss = re.search(r'(?:NISS|N\.?I\.?S\.?S\.?|[Ss]eguran[çc]a\s+[Ss]ocial)[:\s]*(\d{11})', text, re.IGNORECASE)
    if niss:
        data["niss"] = niss.group(1)

    # Passport
    passport = re.search(r'(?:[Pp]assaporte|[Pp]assport)[:\s]*([A-Z]{1,2}\d{5,9})', text)
    if passport:
        data["passaporte"] = passport.group(1)

    # Phone
    phone = re.search(r'(?:\+351|00351)?[\s]?(9[1236]\d[\s]?\d{3}[\s]?\d{3})', text)
    if phone:
        data["telefone"] = phone.group(0).strip()

    # Email
    email = re.search(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)
    if email:
        data["email"] = email.group(0)

    # Nationality
    nac = re.search(r'(?:[Nn]acionalidade|[Nn]atural\s+de)[:\s]+([A-Za-zÀ-ú\s]{3,30})', text)
    if nac:
        data["nacionalidade"] = nac.group(1).strip()

    # Date of birth
    dob = re.search(r'(?:[Nn]asc(?:ido|imento)?|[Dd]ata\s+[Nn]asc)[:\s.]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text)
    if dob:
        data["data_nascimento"] = dob.group(1)

    # Employer
    emp = re.search(r'(?:[Ee]ntidade\s+[Ee]mpregadora|[Ee]mpresa|[Pp]atr[ãa]o)[:\s]+([A-Za-zÀ-ú\s,.-]{3,60})', text)
    if emp:
        data["entidade_empregadora"] = emp.group(1).strip()

    # Address
    morada = re.search(r'(?:[Rr]esid[êe]ncia|[Mm]orada|[Ee]ndere[çc]o)[:\s]+([^\n]{10,80})', text)
    if morada:
        data["morada"] = morada.group(1).strip()

    return data


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def find_client_folder(client_name, base_path):
    """Find the Google Drive folder for a client by name."""
    name_upper = client_name.upper().strip()
    first_name = name_upper.split()[0] if name_upper else ""

    for root, dirs, files in os.walk(base_path):
        for d in dirs:
            d_upper = d.upper().strip()
            if d_upper == name_upper or d_upper == first_name:
                return os.path.join(root, d)
            if first_name and len(first_name) > 3 and first_name in d_upper:
                return os.path.join(root, d)
    return None


def scan_folder_documents(folder_path):
    """Read all PDFs and DOCXs in a folder and extract text."""
    texts = []
    if not folder_path or not os.path.exists(folder_path):
        return texts

    for root, dirs, files in os.walk(folder_path):
        for f in sorted(files):
            filepath = os.path.join(root, f)
            if f.lower().endswith('.pdf'):
                text = extract_pdf_text(filepath)
                if text and len(text) > 50:
                    texts.append({"file": f, "text": text})
            elif f.lower().endswith('.docx'):
                text = extract_docx_text(filepath)
                if text and len(text) > 50:
                    texts.append({"file": f, "text": text})

            if len(texts) >= 10:  # Cap at 10 docs per client
                break
    return texts


def main():
    print("╔════════════════════════════════════════════╗")
    print("║  SD Legal — Enriquecimento de Dados        ║")
    print(f"║  Modo: {'DRY RUN' if DRY_RUN else 'EXECUÇÃO'}                          ║")
    print("╚════════════════════════════════════════════╝\n")

    # Login
    print("🔑 A autenticar no CRM AG...")
    token = crm_login()
    print("   ✓ Autenticado\n")

    # Get all clients
    print("📋 A carregar clientes do CRM...")
    all_clients = []
    page = 1
    while True:
        data = crm_get(f"/api/pessoas?limit=50&page={page}", token)
        all_clients.extend(data["data"]["data"])
        if len(all_clients) >= data["data"]["total"]:
            break
        page += 1

    print(f"   ✓ {len(all_clients)} clientes\n")

    # Get all cases
    print("📋 A carregar casos do CRM...")
    all_cases = []
    page = 1
    while True:
        data = crm_get(f"/api/casos?limit=50&page={page}", token)
        all_cases.extend(data["data"]["data"])
        if len(all_cases) >= data["data"]["total"]:
            break
        page += 1
    print(f"   ✓ {len(all_cases)} casos\n")

    # Process each client
    print("📄 A analisar documentos do Google Drive...\n")

    updates = []

    for client in all_clients:
        if client["categoria"] != "CLIENTE":
            continue

        name = client["nome"]
        client_id = client["id"]

        # Find folder in Drive
        folder = find_client_folder(name, DRIVE_BASE)
        if not folder:
            continue

        # Read documents
        docs = scan_folder_documents(folder)
        if not docs:
            continue

        # Extract data from all documents
        all_extracted = {}
        doc_names = []
        for doc in docs:
            extracted = extract_data_from_text(doc["text"])
            if extracted:
                all_extracted.update(extracted)
                doc_names.append(doc["file"])

        if not all_extracted:
            continue

        # Find associated case
        case_id = None
        for caso in all_cases:
            for cc in caso.get("casoClientes", []):
                if cc.get("clienteId") == client_id:
                    case_id = caso["id"]
                    break

        updates.append({
            "client_id": client_id,
            "client_name": name,
            "case_id": case_id,
            "folder": folder,
            "docs_read": doc_names,
            "extracted": all_extracted,
            "existing": {
                "nif": client.get("nif"),
                "niss": client.get("niss"),
                "email": client.get("email"),
                "whatsapp": client.get("whatsapp"),
                "nacionalidade": client.get("nacionalidade"),
                "morada": client.get("morada"),
                "passaporte": client.get("passaporte"),
            }
        })

    # Report
    print(f"═══════════════════════════════════════════")
    print(f"  DADOS EXTRAÍDOS: {len(updates)} clientes com dados novos")
    print(f"═══════════════════════════════════════════\n")

    for u in updates:
        print(f"📁 {u['client_name']}")
        print(f"   Docs lidos: {', '.join(u['docs_read'][:3])}")

        # Show only NEW data (not already in CRM)
        new_data = {}
        for key, val in u["extracted"].items():
            existing_val = u["existing"].get(key)
            if val and (not existing_val or existing_val.strip() == ""):
                new_data[key] = val

        if new_data:
            for k, v in new_data.items():
                print(f"   🆕 {k}: {v}")
        else:
            print(f"   (sem dados novos — CRM já actualizado)")

        # Case data
        case_fields = {}
        if "numero_processo" in u["extracted"]:
            case_fields["numeroProcesso"] = u["extracted"]["numero_processo"]
        if "tribunal" in u["extracted"]:
            case_fields["observacoes_tribunal"] = u["extracted"]["tribunal"]
        if "juiz" in u["extracted"]:
            case_fields["nomeJuiz"] = u["extracted"]["juiz"]

        if case_fields:
            print(f"   📌 Caso: {case_fields}")

        print()

    if DRY_RUN:
        print("⚠️  MODO DRY RUN — nenhum dado foi actualizado.")
        print("   Para executar: python3 scripts/enrich-clients.py --execute\n")
        return

    # Execute updates
    print("🚀 A ACTUALIZAR CRM...\n")
    updated = 0

    for u in updates:
        new_client_data = {}
        for key, val in u["extracted"].items():
            existing_val = u["existing"].get(key)
            if val and (not existing_val or existing_val.strip() == "") and key in [
                "nif", "niss", "email", "nacionalidade", "morada", "passaporte",
                "telefone", "data_nascimento"
            ]:
                if key == "telefone":
                    new_client_data["whatsapp"] = val
                elif key == "data_nascimento":
                    # Convert to ISO format
                    parts = val.replace("/", "-").split("-")
                    if len(parts) == 3:
                        d, m, y = parts
                        if len(y) == 2:
                            y = "19" + y if int(y) > 50 else "20" + y
                        new_client_data["dataNascimento"] = f"{y}-{m.zfill(2)}-{d.zfill(2)}T00:00:00Z"
                else:
                    new_client_data[key] = val

        if new_client_data:
            result = crm_patch(f"/api/pessoas/{u['client_id']}", token, new_client_data)
            if result and result.get("success"):
                print(f"   ✓ Cliente {u['client_name']}: {list(new_client_data.keys())}")
                updated += 1
            else:
                print(f"   ✗ Cliente {u['client_name']}: erro")
            time.sleep(1)

        # Update case
        if u["case_id"]:
            case_update = {}
            if "numero_processo" in u["extracted"]:
                case_update["numeroProcesso"] = u["extracted"]["numero_processo"]
            if "juiz" in u["extracted"]:
                case_update["nomeJuiz"] = u["extracted"]["juiz"]

            if case_update:
                result = crm_patch(f"/api/casos/{u['case_id']}", token, case_update)
                if result and result.get("success"):
                    print(f"   ✓ Caso: {list(case_update.keys())}")
                else:
                    print(f"   ✗ Caso: erro")
                time.sleep(1)

    print(f"\n═══════════════════════════════════════════")
    print(f"  CONCLUÍDO: {updated} clientes actualizados")
    print(f"═══════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
