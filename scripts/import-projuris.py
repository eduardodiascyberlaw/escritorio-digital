#!/usr/bin/env python3
"""
Importação de clientes do ProJuris (CSV export) para o CRM AG.
Uso: python3 scripts/import-projuris.py [--execute]
"""

import csv, json, re, sys, time, ssl
import urllib.request, urllib.parse

DRY_RUN = "--execute" not in sys.argv
CRM_API = "https://plataforma-crm-juridico.klx2s6.easypanel.host"

_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

# ─── CRM helpers ───

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

def crm_create(path, token, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(f"{CRM_API}{path}", data=data,
                                 headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
                                 method="POST")
    try:
        with urllib.request.urlopen(req, context=_ctx) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        return {"success": False, "error": error_body, "status": e.code}

# ─── Parse ProJuris data ───

def extract_from_notes(notes):
    """Extract NIF, NISS, email, phone from ProJuris notes field."""
    data = {}

    nif = re.search(r'NIF[:\s]*(\d{9})', notes, re.IGNORECASE)
    if nif:
        data["nif"] = nif.group(1)

    niss = re.search(r'NISS[:\s]*(\d{11})', notes, re.IGNORECASE)
    if niss:
        data["niss"] = niss.group(1)

    # Email (skip ProJuris system emails)
    emails = re.findall(r'[\w.+-]+@[\w-]+\.[\w.-]+', notes)
    for email in emails:
        if not any(skip in email.lower() for skip in ['projuris', 'sapo.pt', 'hotmail.com', 'gmail.com']):
            continue
        # Actually, client emails ARE gmail/hotmail - keep first real one
    if emails:
        # Filter out mi@gmail patterns (system-generated)
        real_emails = [e for e in emails if 'mi@' not in e.lower() and 'mi@hotmail' not in e.lower()]
        if not real_emails:
            real_emails = emails
        data["email"] = real_emails[0]

    # Passport
    passport = re.search(r'PASSAPORTE[:\s]*([A-Z]{1,2}\d{5,9})', notes, re.IGNORECASE)
    if passport:
        data["passaporte"] = passport.group(1)

    # Date of birth
    dob = re.search(r'NASC[:\s]*(\d{2}/\d{2}/\d{4})', notes, re.IGNORECASE)
    if dob:
        parts = dob.group(1).split('/')
        data["dataNascimento"] = f"{parts[2]}-{parts[1]}-{parts[0]}T00:00:00Z"

    return data

def map_natureza(natureza):
    """Map ProJuris natureza to CRM AG categoria."""
    n = natureza.lower().strip()
    if n == "trabalhista":
        return "CONTENCIOSO", "Acao Comum (Laboral)", "TRIBUNAIS_JUDICIAIS"
    elif n == "administrativo":
        return "PROC_ADMINISTRATIVO", "Processo Administrativo", None
    elif n in ("cível", "comercial", "bancário", "imobiliário"):
        return "CONTENCIOSO", n.title(), "TRIBUNAIS_JUDICIAIS"
    elif n == "criminal":
        return "CONTENCIOSO", "Criminal", "TRIBUNAIS_JUDICIAIS"
    elif n == "família":
        return "OUTROS", "Família", None
    return "OUTROS", "Outro", None

def title_case(name):
    """Convert UPPER CASE name to Title Case."""
    words = name.strip().split()
    small = {"de", "do", "da", "dos", "das", "e"}
    result = []
    for i, w in enumerate(words):
        if i > 0 and w.lower() in small:
            result.append(w.lower())
        else:
            result.append(w.capitalize())
    return " ".join(result)

# ─── Main ───

def main():
    print("╔════════════════════════════════════════════════╗")
    print("║  SD Legal — Importação ProJuris → CRM AG       ║")
    print(f"║  Modo: {'DRY RUN' if DRY_RUN else 'EXECUÇÃO'}                              ║")
    print("╚════════════════════════════════════════════════╝\n")

    # Read ProJuris data
    print("📁 A ler export do ProJuris...")
    pastas = []
    with open('/tmp/projuris_export/pastas.csv', 'r', encoding='latin-1') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            pastas.append(row)

    processos = {}
    with open('/tmp/projuris_export/processsos.csv', 'r', encoding='latin-1') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            pasta_id = row.get('Pasta', '').strip()
            num = row.get('N\xfamero', row.get('Número', '')).strip().strip('"')
            if pasta_id and num:
                processos[pasta_id] = num

    print(f"   ✓ {len(pastas)} pastas, {len(processos)} processos com número\n")

    # Deduplicate by client name
    unique_clients = {}
    for p in pastas:
        name = p.get('Cliente', '').strip()
        if not name:
            continue
        key = name.upper()
        if key not in unique_clients:
            unique_clients[key] = {
                "nome": name,
                "pastas": [],
            }
        # Collect all notes/data
        notes = (p.get('Fatos', '') or '') + ' ' + (p.get('Estrat\xe9gia', p.get('Estratégia', '')) or '')
        pasta_id = p.get('Pasta', '').strip()
        unique_clients[key]["pastas"].append({
            "pasta_id": pasta_id,
            "tipo": p.get('Tipo', ''),
            "natureza": p.get('Natureza', ''),
            "adverso": p.get('Adverso', ''),
            "distribuicao": (p.get('Distribui\xe7\xe3o', p.get('Distribuição', '')) or '').strip(),
            "notes": notes.strip(),
            "processo_num": processos.get(pasta_id, ''),
            "encerrado": p.get('Encerrado', '').strip(),
        })

    print(f"   Clientes únicos: {len(unique_clients)}\n")

    # Login CRM
    print("🔑 A autenticar no CRM AG...")
    token = crm_login()
    print("   ✓ OK\n")

    # Get existing clients
    print("📋 A carregar CRM existente...")
    existing = crm_get_all("/api/pessoas", token)
    existing_names = set()
    for e in existing:
        existing_names.add(e["nome"].upper().strip())
        # Also add first name for fuzzy matching
        first = e["nome"].upper().strip().split()[0]
        existing_names.add(first)
    print(f"   ✓ {len(existing)} clientes existentes\n")

    # Find new clients
    to_import = []
    already_exists = []

    for key, client_data in unique_clients.items():
        name_upper = key.strip()
        first_name = name_upper.split()[0] if name_upper else ""

        found = name_upper in existing_names
        if not found and first_name:
            # Check if any existing name contains this first name
            for existing_name in existing_names:
                if first_name in existing_name or existing_name in name_upper:
                    found = True
                    break

        if found:
            already_exists.append(client_data)
        else:
            # Extract data from notes
            all_notes = " ".join(p["notes"] for p in client_data["pastas"])
            extracted = extract_from_notes(all_notes)
            client_data["extracted"] = extracted

            # Only import active (non-encerrado) or important ones
            has_active = any(p["encerrado"] != "Sim" for p in client_data["pastas"])
            client_data["has_active"] = has_active

            to_import.append(client_data)

    # Report
    print(f"═══════════════════════════════════════════")
    print(f"  RELATÓRIO DE IMPORTAÇÃO")
    print(f"═══════════════════════════════════════════\n")
    print(f"  Total ProJuris:    {len(unique_clients)}")
    print(f"  Já no CRM:         {len(already_exists)}")
    print(f"  A importar:        {len(to_import)}")

    active = [c for c in to_import if c["has_active"]]
    closed = [c for c in to_import if not c["has_active"]]
    print(f"    ├── Com casos activos: {len(active)}")
    print(f"    └── Só encerrados:     {len(closed)}")

    # Show sample
    print(f"\n  Primeiros 20 a importar (activos):")
    for c in active[:20]:
        pastas_info = []
        for p in c["pastas"]:
            nat = p["natureza"][:15] if p["natureza"] else "?"
            num = p["processo_num"][:20] if p["processo_num"] else ""
            pastas_info.append(f"{nat}" + (f" ({num})" if num else ""))
        extracted = c.get("extracted", {})
        extras = []
        if extracted.get("nif"): extras.append(f"NIF:{extracted['nif']}")
        if extracted.get("niss"): extras.append(f"NISS:{extracted['niss']}")
        print(f"    • {title_case(c['nome'])} — {', '.join(pastas_info)} {' '.join(extras)}")

    if DRY_RUN:
        print(f"\n⚠️  MODO DRY RUN — nenhum cliente criado.")
        print(f"   Para executar: python3 scripts/import-projuris.py --execute\n")
        return

    # Execute import (only active clients)
    print(f"\n🚀 A IMPORTAR {len(active)} clientes com casos activos...\n")

    eduardo_id = "e59b40e3-79b6-4db4-8b4c-0116b9f6a283"
    created_clients = 0
    created_cases = 0
    errors = 0

    for client_data in active:
        extracted = client_data.get("extracted", {})

        # Create client
        body = {
            "tipoPessoa": "PARTICULAR",
            "categoria": "CLIENTE",
            "nome": title_case(client_data["nome"]),
            "observacoes": f"Importado do ProJuris",
        }
        if extracted.get("nif"): body["nif"] = extracted["nif"]
        if extracted.get("niss"): body["niss"] = extracted["niss"]
        if extracted.get("email"): body["email"] = extracted["email"]
        if extracted.get("passaporte"): body["passaporte"] = extracted["passaporte"]
        if extracted.get("dataNascimento"): body["dataNascimento"] = extracted["dataNascimento"]

        result = crm_create("/api/pessoas", token, body)
        if not result.get("success"):
            if result.get("status") == 429:
                print("   ⏸ Rate limit — pausa 60s...")
                time.sleep(60)
                token = crm_login()  # Re-login
                result = crm_create("/api/pessoas", token, body)

            if not result.get("success"):
                print(f"   ✗ {title_case(client_data['nome'])}: {result.get('error', '')[:80]}")
                errors += 1
                time.sleep(1)
                continue

        client_id = result["data"]["id"]
        created_clients += 1

        # Create case(s) for this client
        for pasta in client_data["pastas"]:
            if pasta["encerrado"] == "Sim":
                continue

            categoria, tipo_caso, jurisdicao = map_natureza(pasta["natureza"])
            caso_body = {
                "titulo": f"{tipo_caso} — {title_case(client_data['nome'])}",
                "categoria": categoria,
                "tipoCaso": tipo_caso,
                "estado": "ABERTO",
                "responsaveis": [{"clienteId": eduardo_id, "principal": True}],
                "clientes": [{"clienteId": client_id, "papel": "Titular"}],
            }
            if jurisdicao:
                caso_body["jurisdicao"] = jurisdicao
            if pasta["processo_num"]:
                if categoria == "PROC_ADMINISTRATIVO":
                    caso_body["numeroProcessoAdmin"] = pasta["processo_num"]
                else:
                    caso_body["numeroProcesso"] = pasta["processo_num"]
            if pasta["adverso"]:
                caso_body["observacoes"] = f"Adverso: {pasta['adverso']}"

            caso_result = crm_create("/api/casos", token, caso_body)
            if caso_result.get("success"):
                created_cases += 1
            elif caso_result.get("status") == 429:
                print("   ⏸ Rate limit — pausa 60s...")
                time.sleep(60)
                token = crm_login()
                caso_result = crm_create("/api/casos", token, caso_body)
                if caso_result.get("success"):
                    created_cases += 1

        # Progress
        if created_clients % 10 == 0:
            print(f"   ... {created_clients} clientes, {created_cases} casos")

        time.sleep(0.8)

    print(f"\n═══════════════════════════════════════════")
    print(f"  CONCLUÍDO: {created_clients} clientes + {created_cases} casos criados ({errors} erros)")
    print(f"═══════════════════════════════════════════\n")


if __name__ == "__main__":
    main()
