import { NextRequest, NextResponse } from 'next/server';

const CONTA_OVOS_BASE = 'https://contaovos.com/pt-br/api';
const API_KEY = process.env.CONTAOVOS_API_KEY ?? '';

// Parâmetros permitidos para o GET (whitelist para evitar injection)
const ALLOWED_GET_PARAMS = new Set([
  'state',
  'municipality',
  'country',
  'page',
  'id',
  'date',
  'date_collect',
]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const params = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (ALLOWED_GET_PARAMS.has(key)) {
      // Sanitize: only allow safe characters in param values
      const sanitized = value.replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();
      if (sanitized) {
        params.set(key, sanitized);
      }
    }
  }

  try {
    const url = `${CONTA_OVOS_BASE}/lastcountingpublic?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      // Cache for 5 minutes to reduce load on external API
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao consultar a API Conta Ovos', status: response.status },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Falha na comunicação com a API Conta Ovos' },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Chave da API Conta Ovos não configurada no servidor' },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  // Validate required fields
  if (
    typeof body.ovitrap_group_id !== 'number' ||
    typeof body.ovitrap_lat !== 'number' ||
    typeof body.ovitrap_lng !== 'number' ||
    typeof body.date !== 'string' ||
    typeof body.counting_observation_id !== 'number' ||
    typeof body.counting_eggs !== 'number'
  ) {
    return NextResponse.json(
      { error: 'Campos obrigatórios ausentes ou inválidos no payload' },
      { status: 400 },
    );
  }

  // Inject API key server-side — never expose it to the client
  const payload = { ...body, key: API_KEY };

  try {
    const response = await fetch(`${CONTA_OVOS_BASE}/postcounting`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(
        Object.fromEntries(
          Object.entries(payload).map(([k, v]) => [k, String(v)]),
        ),
      ).toString(),
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao enviar leitura para a API Conta Ovos', detail: data },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Falha na comunicação com a API Conta Ovos' },
      { status: 502 },
    );
  }
}
