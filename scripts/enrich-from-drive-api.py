#!/usr/bin/env python3
"""
Enriquecer dados de clientes lendo PDFs directamente via Google Drive API.
Extrai: número de processo, tribunal, juiz, NIF, NISS, etc.

Uso: python3 scripts/enrich-from-drive-api.py [--execute]
"""

import json, os, sys, re, time, tempfile, ssl, io
import urllib.request, urllib.parse

try:
    import fitz  # PyMuPDF
except ImportError:
    print("pip3 install pymupdf"); sys.exit(1)

DRY_RUN = "--execute" not in sys.argv

# ─── SSL context (Python 3.14 issue) ───
_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

# ─── Google Drive Auth ───

def get_drive_token():
    with open(os.path.expanduser("~/.config/gcloud/application_default_credentials.json")) as f:
        creds = json.load(f)
    data = urllib.parse.urlencode({
        "client_id": creds["client_id"],
        "client_secret": creds["client_secret"],
        "refresh_token": creds["refresh_token"],
        "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=data, method="POST")
    with urllib.request.urlopen(req, context=_ctx) as resp:
        return json.loads(resp.read())["access_token"]

QUOTA_PROJECT = "514934487167"

def drive_get(url, token):
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "x-goog-user-project": QUOTA_PROJECT,
    })
    with urllib.request.urlopen(req, context=_ctx) as resp:
        return json.loads(resp.read())

def drive_download(file_id, token):
    url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "x-goog-user-project": QUOTA_PROJECT,
    })
    with urllib.request.urlopen(req, context=_ctx) as resp:
        return resp.read()

def drive_list_folder(folder_id, token, mime_filter=None):
    q = f"'{folder_id}' in parents and trashed=false"
    if mime_filter:
        q += f" and mimeType='{mime_filter}'"
    url = f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(q)}&fields=files(id,name,mimeType,size)&pageSize=100"
    return drive_get(url, token).get("files", [])

def drive_find_folder(name, token, parent_id=None):
    q = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_id:
        q += f" and '{parent_id}' in parents"
    url = f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(q)}&fields=files(id,name)"
    files = drive_get(url, token).get("files", [])
    return files[0]["id"] if files else None

# ─── CRM Auth ───

CRM_API = "https://plataforma-crm-juridico.klx2s6.easypanel.host"

def crm_login():
    data = json.dumps({"email": "admin@escritorio.pt", "password": "Mariana123mudar#"}).encode()
    req = urllib.request.Request(f"{CRM_API}/api/auth/login", data=data,
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, context=_ctx) as resp:
        return json.loads(resp.read())["data"]["accessToken"]

def crm_get_all(path, token):
    items = []
    page = 1
    while True:
        req = urllib.request.Request(f"{CRM_API}{path}?limit=50&page={page}",
                                     headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, context=_ctx) as resp:
            data = json.loads(resp.read())
        items.extend(data["data"]["data"])
        if len(items) >= data["data"]["total"]:
            break
        page += 1
    return items

def crm_patch(path, token, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{CRM_API}{path}", data=data,
                                 headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
                                 method="PATCH")
    try:
        with urllib.request.urlopen(req, context=_ctx) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"success": False, "error": str(e)}

# ─── PDF text extraction ───

def extract_pdf_text(pdf_bytes, max_pages=3):
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            text += page.get_text()
        doc.close()
        return text[:5000]
    except:
        return ""

# ─── Data extraction ───

def extract_case_data(text):
    data = {}

    # Process number (Citius: NNNN/NN.NXXXXXX)
    proc = re.search(r'(\d{1,5}/\d{2}\.\d[A-Z0-9]+)', text)
    if proc:
        data["numero_processo"] = proc.group(1)

    # SITAF process number (NNNNN/NN.NBEXXXX)
    sitaf = re.search(r'(\d{1,6}/\d{2}\.\d[A-Z]{2}[A-Z0-9]*)', text)
    if sitaf and "numero_processo" not in data:
        data["numero_processo"] = sitaf.group(1)

    # Tribunal patterns
    patterns = [
        r'(Ju[íi]zo\s+(?:do\s+)?(?:Trabalho|Local\s+C[íi]vel|Central|Administrativo|Fam[íi]lia|Com[ée]rcio)[^\n]{0,80})',
        r'(Tribunal\s+Administrativo\s+e\s+Fiscal\s+[^\n]{0,40})',
        r'(TAF\s+de?\s+[A-Za-zÀ-ú]+)',
        r'(Tribunal\s+(?:Judicial|da\s+Comarca|Central)[^\n]{0,60})',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            data["tribunal"] = m.group(1).strip()[:100]
            break

    # Judge
    for pat in [
        r'(?:Meritíssim[oa]\s+Ju[íi]z[a]?\s+)([A-ZÀ-Ú][^\n]{5,40})',
        r'(?:Ju[íi]z[a]?\s+\d?\s*[-:]\s*)([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})',
        r'(?:Ju[íi]z\s+)(\d)',
    ]:
        m = re.search(pat, text)
        if m:
            data["juiz"] = m.group(1).strip()[:60]
            break

    # NIF
    nif = re.search(r'(?:NIF|N\.?I\.?F\.?|contribuinte)[:\s]*(\d{9})\b', text, re.IGNORECASE)
    if nif:
        data["nif"] = nif.group(1)

    # NISS
    niss = re.search(r'(?:NISS|N\.?I\.?S\.?S\.?)[:\s]*(\d{11})\b', text, re.IGNORECASE)
    if niss:
        data["niss"] = niss.group(1)

    # Passport
    passport = re.search(r'(?:[Pp]assaporte)[:\s]*([A-Z]{1,2}\d{5,9})', text)
    if passport:
        data["passaporte"] = passport.group(1)

    # Nationality
    nac = re.search(r'[Nn]acionalidade[:\s]+([A-Za-zÀ-ú]+)', text)
    if nac:
        val = nac.group(1).strip()
        if len(val) > 3 and val.lower() not in ["de", "do", "da", "dos", "das"]:
            data["nacionalidade"] = val

    return data

# ─── Main ───

def main():
    print("╔════════════════════════════════════════════════╗")
    print("║  SD Legal — Enriquecimento via Google Drive API ║")
    print(f"║  Modo: {'DRY RUN' if DRY_RUN else 'EXECUÇÃO'}                              ║")
    print("╚════════════════════════════════════════════════╝\n")

    # Auth
    print("🔑 Google Drive API...")
    drive_token = get_drive_token()
    print("   ✓ OK")

    print("🔑 CRM AG API...")
    crm_token = crm_login()
    print("   ✓ OK\n")

    # Find root folder
    print("📁 A procurar PASTA CLIENTES AÇÕES...")
    root_id = drive_find_folder("PASTA CLIENTES AÇÕES", drive_token)
    if not root_id:
        print("   ✗ Pasta não encontrada!")
        return
    print(f"   ✓ ID: {root_id}\n")

    # Get CRM data
    print("📋 A carregar CRM...")
    clients = crm_get_all("/api/pessoas", crm_token)
    cases = crm_get_all("/api/casos", crm_token)
    print(f"   ✓ {len(clients)} clientes, {len(cases)} casos\n")

    # Map client names to IDs and their case IDs
    client_map = {}  # name_upper -> {client_id, case_id, existing_data}
    for c in clients:
        if c["categoria"] != "CLIENTE":
            continue
        case_id = None
        for caso in cases:
            for cc in caso.get("casoClientes", []):
                if cc.get("clienteId") == c["id"]:
                    case_id = caso["id"]
                    break
        client_map[c["nome"].upper().strip()] = {
            "client_id": c["id"],
            "case_id": case_id,
            "nome": c["nome"],
            "nif": c.get("nif"),
            "niss": c.get("niss"),
            "passaporte": c.get("passaporte"),
            "nacionalidade": c.get("nacionalidade"),
        }
        # Also map first name
        first = c["nome"].upper().strip().split()[0]
        if first not in client_map:
            client_map[first] = client_map[c["nome"].upper().strip()]

    # Recursively scan Drive folders for PDFs
    print("📄 A analisar documentos judiciais do Drive...\n")

    updates = []

    def scan_folder(folder_id, folder_name, depth=0):
        if depth > 4:
            return

        items = drive_list_folder(folder_id, drive_token)
        time.sleep(0.3)

        # Find matching client
        folder_upper = folder_name.upper().strip()
        client_info = client_map.get(folder_upper)
        if not client_info:
            # Try first word
            first = folder_upper.split()[0] if folder_upper else ""
            client_info = client_map.get(first)

        # Process PDFs in this folder
        pdfs = [f for f in items if f["name"].lower().endswith(".pdf")]
        # Prioritize judicial documents
        judicial_pdfs = [f for f in pdfs if any(k in f["name"].lower() for k in
                         ["actoprocessual", "audiencia", "sentença", "sentneca",
                          "despacho", "citação", "notificação", "cautelar",
                          "petiç", "contestaç", "alegaç"])]

        target_pdfs = judicial_pdfs if judicial_pdfs else pdfs[:3]

        if client_info and target_pdfs:
            all_data = {}
            docs_read = []

            for pdf in target_pdfs[:5]:
                try:
                    content = drive_download(pdf["id"], drive_token)
                    text = extract_pdf_text(content)
                    if text:
                        extracted = extract_case_data(text)
                        if extracted:
                            all_data.update(extracted)
                            docs_read.append(pdf["name"])
                    time.sleep(0.5)
                except Exception as e:
                    pass

            if all_data:
                updates.append({
                    "client_info": client_info,
                    "folder": folder_name,
                    "docs": docs_read,
                    "data": all_data,
                })

        # Recurse into subfolders
        subfolders = [f for f in items if f["mimeType"] == "application/vnd.google-apps.folder"]
        for sf in subfolders:
            scan_folder(sf["id"], sf["name"], depth + 1)

    # Start scanning from root
    root_items = drive_list_folder(root_id, drive_token)
    root_subfolders = [f for f in root_items if f["mimeType"] == "application/vnd.google-apps.folder"]

    for i, sf in enumerate(root_subfolders):
        print(f"  [{i+1}/{len(root_subfolders)}] {sf['name']}...")
        scan_folder(sf["id"], sf["name"])

    # Report
    print(f"\n═══════════════════════════════════════════")
    print(f"  DADOS JUDICIAIS EXTRAÍDOS: {len(updates)} clientes")
    print(f"═══════════════════════════════════════════\n")

    for u in updates:
        info = u["client_info"]
        print(f"📁 {info['nome']}")
        print(f"   Docs: {', '.join(u['docs'][:3])}")
        for k, v in u["data"].items():
            # Check if it's new data
            existing = info.get(k)
            marker = "🆕" if not existing else "📌"
            print(f"   {marker} {k}: {v}")
        print()

    if DRY_RUN:
        print("⚠️  MODO DRY RUN — nenhum dado actualizado.")
        print("   Para executar: python3 scripts/enrich-from-drive-api.py --execute\n")
        return

    # Execute updates
    print("🚀 A ACTUALIZAR CRM...\n")
    updated_clients = 0
    updated_cases = 0

    for u in updates:
        info = u["client_info"]
        data = u["data"]

        # Update client
        client_patch = {}
        for field in ["nif", "niss", "passaporte", "nacionalidade"]:
            if field in data and not info.get(field):
                client_patch[field] = data[field]

        if client_patch:
            result = crm_patch(f"/api/pessoas/{info['client_id']}", crm_token, client_patch)
            if result.get("success"):
                print(f"   ✓ Cliente {info['nome']}: {list(client_patch.keys())}")
                updated_clients += 1
            else:
                print(f"   ✗ Cliente {info['nome']}: {result}")
            time.sleep(1)

        # Update case
        if info["case_id"]:
            case_patch = {}
            if "numero_processo" in data:
                case_patch["numeroProcesso"] = data["numero_processo"]
            if "juiz" in data:
                case_patch["nomeJuiz"] = data["juiz"]

            if case_patch:
                result = crm_patch(f"/api/casos/{info['case_id']}", crm_token, case_patch)
                if result.get("success"):
                    print(f"   ✓ Caso {info['nome']}: {list(case_patch.keys())}")
                    updated_cases += 1
                else:
                    print(f"   ✗ Caso {info['nome']}: {result}")
                time.sleep(1)

    print(f"\n═══════════════════════════════════════════")
    print(f"  CONCLUÍDO: {updated_clients} clientes + {updated_cases} casos actualizados")
    print(f"═══════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
