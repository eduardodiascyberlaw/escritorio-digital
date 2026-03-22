export interface ChamadoHumano {
  ticket_id: string;
  tipo:
    | "dados_em_falta"
    | "validacao_migracao"
    | "escalamento_juridico"
    | "decisao_critica";
  urgencia: "imediata" | "hoje" | "esta_semana";
  cliente_id: string;
  descricao: string;
  campos_em_falta?: string[];
  responsavel_sugerido?: string;
  prazo?: string;
}
