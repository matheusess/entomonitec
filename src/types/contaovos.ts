// Resposta do GET /lastcountingpublic
export interface IContaOvosOvitrap {
  counting_id: number;
  date?: string;
  date_collect?: string;
  eggs?: number;
  latitude: number;
  longitude: number;
  municipality?: string;
  municipality_code?: string;
  ovitrap_id: string;         // identificador string da ovitrampa (ex: "8917")
  ovitrap_website_id: number; // id numérico usado como group_id no POST
  state_code?: string;
  state_name?: string;
  time?: string;
  week?: number;
  year?: number;
}

// Parâmetros de busca (GET)
export interface ContaOvosSearchParams {
  state?: string;
  municipality?: string;
  country?: string;
  page?: number;
  id?: number;
  date?: string;
  date_collect?: string;
}

// Payload para envio de leitura em ovitrampa existente
export interface ContaOvosPostData {
  ovitrap_group_id: number;
  ovitrap_lat: number;
  ovitrap_lng: number;
  date: string; // YYYY-MM-DD
  counting_observation_id: number; // 1-10
  counting_observation?: string; // obrigatório quando observation_id = 10
  counting_eggs: number;
}

// Payload para instalação de nova ovitrampa + leitura
export interface ContaOvosInstallData extends ContaOvosPostData {
  ovitrap_address_district?: string;
  ovitrap_address_street?: string;
  ovitrap_address_number?: string;
  ovitrap_address_complement?: string;
  ovitrap_address_loc_inst?: string;
  ovitrap_address_sector?: string;
  ovitrap_responsable?: string;
  ovitrap_block_id?: string;
  counting_date_collect?: string; // YYYY-MM-DD
}

export interface ContaOvosPostResponse {
  success: boolean;
  message?: string;
  id?: number;
}

// Tabela de observações da API
export const COUNTING_OBSERVATIONS = [
  { id: 1, label: 'Sem Observações' },
  { id: 2, label: 'Intervalo entre instalação e coleta maior que o previsto' },
  { id: 3, label: 'Ovitrampa ou paleta desaparecida' },
  { id: 4, label: 'Ovitrampa ou paleta quebrada' },
  { id: 5, label: 'Ovitrampa ou paleta removida' },
  { id: 6, label: 'Ovitrampa seca' },
  { id: 7, label: 'Casa fechada' },
  { id: 8, label: 'Ovitrampa cheia de água' },
  { id: 9, label: 'Ovitrampa com pouca água' },
  { id: 10, label: 'Outra Observação' },
] as const;

export type CountingObservationId = (typeof COUNTING_OBSERVATIONS)[number]['id'];

// Lista de UFs brasileiras para o seletor de estado
export const BRASIL_UFS = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PR', name: 'Paraná' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'TO', name: 'Tocantins' },
] as const;
