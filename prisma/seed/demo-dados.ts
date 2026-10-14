// Gerador dos dados de demonstração (Fase 6, SPEC §9). Puro e determinístico: sem banco, sem
// storage e sem `Math.random`, então rodar duas vezes com a mesma `agora` gera o mesmo conjunto
// (a conferência manual dos indicadores fica reprodutível). Quem grava é prisma/seed/demo.ts.
//
// Tudo fica em UTs com código `DEMO-NN`. Os usuários de demonstração existem só como donos dos
// itens e autores das solicitações: não têm conta (senha), então ninguém consegue entrar com eles.

export const PREFIXO_UT_DEMO = "DEMO-";

const QUANTIDADE_UTS = 12;
const QUANTIDADE_ITENS = 150;
const QUANTIDADE_SOLICITACOES = 60;
const QUANTIDADE_FOTOS_GENERICAS = 6;

const MS_HORA = 60 * 60 * 1000;
const MS_DIA = 24 * MS_HORA;

/** Cidades reais de 12 estados diferentes: o dashboard mostra origem e destino em UFs distintas. */
const CIDADES: Array<{ cidade: string; uf: string }> = [
  { cidade: "São Paulo", uf: "SP" },
  { cidade: "Rio de Janeiro", uf: "RJ" },
  { cidade: "Belo Horizonte", uf: "MG" },
  { cidade: "Salvador", uf: "BA" },
  { cidade: "Curitiba", uf: "PR" },
  { cidade: "Porto Alegre", uf: "RS" },
  { cidade: "Recife", uf: "PE" },
  { cidade: "Fortaleza", uf: "CE" },
  { cidade: "Goiânia", uf: "GO" },
  { cidade: "Manaus", uf: "AM" },
  { cidade: "Vitória", uf: "ES" },
  { cidade: "Belém", uf: "PA" },
];

type Categoria = "ativo" | "material";
type Segmento = "industrial" | "facilities" | "logistica" | "mineracao" | "energia" | "oleo_gas";
type Estado = "novo" | "usado_bom" | "com_defeito";
type Unidade = "un" | "cx" | "kg" | "m" | "l" | "par" | "jogo";

type Modelo = {
  nome: string;
  marca: string;
  modelo: string;
  categoria: Categoria;
  segmentos: Segmento[];
  valor: [number, number];
  /** Largura × altura × profundidade (cm) e peso (kg), por unidade. */
  medidas: [number, number, number, number];
  unidade: Unidade;
  quantidade: [number, number];
};

const MODELOS: Modelo[] = [
  { nome: "Furadeira de impacto", marca: "Bosch", modelo: "GSB 13 RE", categoria: "material", segmentos: ["industrial", "facilities"], valor: [380, 620], medidas: [30, 25, 10, 1.8], unidade: "un", quantidade: [2, 12] },
  { nome: "Parafusadeira a bateria", marca: "Makita", modelo: "DDF484", categoria: "material", segmentos: ["industrial", "energia"], valor: [900, 1400], medidas: [26, 22, 8, 1.6], unidade: "un", quantidade: [2, 10] },
  { nome: "Esmerilhadeira angular 4.1/2\"", marca: "DeWalt", modelo: "DWE4120", categoria: "material", segmentos: ["industrial", "mineracao"], valor: [350, 580], medidas: [33, 12, 12, 1.9], unidade: "un", quantidade: [3, 15] },
  { nome: "Capacete de segurança", marca: "3M", modelo: "H-700", categoria: "material", segmentos: ["industrial", "mineracao", "energia", "oleo_gas"], valor: [28, 65], medidas: [28, 20, 22, 0.4], unidade: "un", quantidade: [30, 180] },
  { nome: "Luva de proteção nitrílica", marca: "Danny", modelo: "DA-1100", categoria: "material", segmentos: ["industrial", "facilities", "logistica"], valor: [12, 30], medidas: [26, 12, 4, 0.1], unidade: "par", quantidade: [50, 400] },
  { nome: "Óculos de proteção", marca: "Vicsa", modelo: "Spectra 2000", categoria: "material", segmentos: ["industrial", "mineracao", "oleo_gas"], valor: [9, 22], medidas: [16, 6, 14, 0.08], unidade: "un", quantidade: [40, 300] },
  { nome: "Extintor de CO2 6 kg", marca: "Kidde", modelo: "CO2-6", categoria: "material", segmentos: ["industrial", "facilities", "oleo_gas"], valor: [680, 1100], medidas: [25, 70, 25, 14], unidade: "un", quantidade: [3, 20] },
  { nome: "Escada de alumínio 7 degraus", marca: "Alulev", modelo: "ES-07", categoria: "material", segmentos: ["facilities", "industrial"], valor: [420, 760], medidas: [45, 200, 12, 6.5], unidade: "un", quantidade: [1, 8] },
  { nome: "Cabo de aço 3/8\"", marca: "Cimaf", modelo: "6x25", categoria: "material", segmentos: ["mineracao", "oleo_gas", "logistica"], valor: [14, 28], medidas: [60, 60, 25, 22], unidade: "m", quantidade: [100, 600] },
  { nome: "Rolamento autocompensador", marca: "SKF", modelo: "2210 E-2RS1", categoria: "material", segmentos: ["industrial", "mineracao"], valor: [180, 460], medidas: [11, 9, 11, 0.9], unidade: "un", quantidade: [4, 40] },
  { nome: "Lubrificante industrial EP 220", marca: "Petronas", modelo: "Tutela GI", categoria: "material", segmentos: ["industrial", "energia"], valor: [310, 540], medidas: [35, 45, 35, 18], unidade: "un", quantidade: [4, 30] },
  { nome: "Disjuntor tripolar 63A", marca: "Schneider", modelo: "iC60N", categoria: "material", segmentos: ["energia", "industrial", "facilities"], valor: [140, 320], medidas: [5.4, 8.5, 7, 0.4], unidade: "un", quantidade: [5, 60] },
  { nome: "Compressor de ar 50 litros", marca: "Schulz", modelo: "CSI 8.5/50", categoria: "ativo", segmentos: ["industrial", "facilities"], valor: [1900, 3200], medidas: [90, 70, 40, 38], unidade: "un", quantidade: [1, 4] },
  { nome: "Lavadora de alta pressão", marca: "Kärcher", modelo: "HD 585", categoria: "ativo", segmentos: ["facilities", "industrial"], valor: [3600, 6400], medidas: [40, 70, 40, 22], unidade: "un", quantidade: [1, 4] },
  { nome: "Aspirador industrial 50 L", marca: "Electrolux", modelo: "A20", categoria: "ativo", segmentos: ["facilities", "industrial"], valor: [1400, 2600], medidas: [45, 65, 45, 14], unidade: "un", quantidade: [1, 5] },
  { nome: "Lavadora de piso", marca: "Tennant", modelo: "T3", categoria: "ativo", segmentos: ["facilities", "logistica"], valor: [18000, 32000], medidas: [70, 105, 125, 150], unidade: "un", quantidade: [1, 2] },
  { nome: "Empilhadeira elétrica", marca: "Paletrans", modelo: "EP 1500", categoria: "ativo", segmentos: ["logistica", "industrial"], valor: [48000, 92000], medidas: [110, 210, 250, 1900], unidade: "un", quantidade: [1, 2] },
  { nome: "Gerador a diesel 20 kVA", marca: "Branco", modelo: "BD-20000", categoria: "ativo", segmentos: ["energia", "mineracao", "oleo_gas"], valor: [24000, 41000], medidas: [150, 110, 70, 520], unidade: "un", quantidade: [1, 2] },
  { nome: "Roçadeira a gasolina", marca: "Stihl", modelo: "FS 220", categoria: "ativo", segmentos: ["facilities", "energia"], valor: [2800, 4600], medidas: [180, 30, 30, 8.4], unidade: "un", quantidade: [1, 6] },
  { nome: "Bomba submersa 1 cv", marca: "Schneider", modelo: "BCS-1", categoria: "ativo", segmentos: ["mineracao", "industrial", "oleo_gas"], valor: [1600, 2900], medidas: [20, 55, 20, 12], unidade: "un", quantidade: [1, 5] },
  { nome: "Notebook corporativo", marca: "Dell", modelo: "Latitude 3440", categoria: "ativo", segmentos: ["facilities", "logistica"], valor: [3800, 5600], medidas: [32, 2.2, 22, 1.6], unidade: "un", quantidade: [1, 8] },
  { nome: "Impressora térmica de etiquetas", marca: "Zebra", modelo: "ZT230", categoria: "ativo", segmentos: ["logistica"], valor: [5200, 8800], medidas: [27, 28, 46, 11], unidade: "un", quantidade: [1, 3] },
  { nome: "Ar-condicionado split 18.000 BTU", marca: "Springer", modelo: "Midea Inverter", categoria: "ativo", segmentos: ["facilities"], valor: [2900, 4300], medidas: [92, 30, 22, 38], unidade: "un", quantidade: [1, 5] },
  { nome: "Balança de plataforma 500 kg", marca: "Toledo", modelo: "2098", categoria: "ativo", segmentos: ["logistica", "industrial"], valor: [4200, 7600], medidas: [60, 90, 60, 48], unidade: "un", quantidade: [1, 3] },
  { nome: "Carrinho plataforma 300 kg", marca: "Metalcorte", modelo: "CP-300", categoria: "ativo", segmentos: ["logistica", "facilities"], valor: [380, 720], medidas: [90, 90, 60, 18], unidade: "un", quantidade: [2, 10] },
  { nome: "Detector de gases portátil", marca: "MSA", modelo: "ALTAIR 4XR", categoria: "ativo", segmentos: ["oleo_gas", "mineracao", "energia"], valor: [6800, 11500], medidas: [11, 17, 6, 0.4], unidade: "un", quantidade: [1, 6] },
];

const ESTADOS: Estado[] = ["novo", "usado_bom", "usado_bom", "usado_bom", "com_defeito"];

const DESCRICOES = [
  "Em bom estado, parado no almoxarifado.",
  "Sobra de obra. Mantido na embalagem original.",
  "Equipamento revisado, sem uso nos últimos meses.",
  "Retirada no almoxarifado da UT.",
];

const OBSERVACOES = [
  "Preciso para a parada programada do próximo mês.",
  "Substitui um equipamento que quebrou.",
  "Vamos usar na nova frente de serviço.",
  "Atende uma demanda do cliente.",
];

const NOMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabriela", "Hugo", "Isabela", "João", "Karina", "Lucas"];
const SOBRENOMES = ["Almeida", "Barros", "Cardoso", "Dias", "Esteves", "Ferreira", "Gomes", "Henrique", "Ibrahim", "Lima", "Moreira", "Nunes"];

// ---------------------------------------------------------------------------------------
// Tipos do conjunto gerado
// ---------------------------------------------------------------------------------------

export type DemoUt = { codigo: string; nome: string; cidade: string; uf: string };

export type DemoUsuario = {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  papel: "almoxarife" | "colaborador";
  utCodigo: string;
};

export type DemoItem = {
  id: string;
  utCodigo: string;
  criadoPorId: string;
  categoria: Categoria;
  segmento: Segmento;
  rm: string;
  nome: string;
  marca: string;
  modelo: string;
  descricao: string | null;
  estado: Estado;
  unidade: Unidade;
  quantidadeTotal: number;
  quantidadeDisponivel: number;
  valorUnitarioReposicao: number;
  valorDepreciacaoMensal: number | null;
  larguraCm: number;
  alturaCm: number;
  profundidadeCm: number;
  pesoKg: number;
  lote: { larguraCm: number; alturaCm: number; profundidadeCm: number; pesoKg: number } | null;
  status: "disponivel" | "esgotado" | "arquivado";
  criadoEm: Date;
  /** Índice (0 a 5) das fotos genéricas deste item. */
  fotos: number[];
};

export type DemoSolicitacao = {
  id: string;
  itemId: string;
  solicitanteId: string;
  utDestinoCodigo: string;
  respondidaPorId: string;
  concluidaPorId: string;
  quantidade: number;
  observacao: string | null;
  valorUnitarioSnapshot: number;
  custoFrete: number;
  criadoEm: Date;
  respondidaEm: Date;
  concluidaEm: Date;
};

export type ConjuntoDemo = {
  uts: DemoUt[];
  usuarios: DemoUsuario[];
  itens: DemoItem[];
  solicitacoes: DemoSolicitacao[];
  quantidadeFotosGenericas: number;
};

// ---------------------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------------------

/** PRNG determinístico (mulberry32). */
function criarAleatorio(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const doisDigitos = (n: number): string => String(n).padStart(2, "0");
const arredondar2 = (n: number): number => Math.round(n * 100) / 100;

/** Gera um CPF com dígitos verificadores corretos a partir de 9 dígitos. */
export function cpfComDigitos(base9: string): string {
  const calcular = (digitos: number[]): number => {
    const soma = digitos.reduce((acc, d, i) => acc + d * (digitos.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const digitos = base9.split("").map(Number);
  const d1 = calcular(digitos);
  const d2 = calcular([...digitos, d1]);
  return `${base9}${d1}${d2}`;
}

// ---------------------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------------------

export function gerarConjuntoDemo(agora: Date): ConjuntoDemo {
  const aleatorio = criarAleatorio(20261014);
  const entre = (min: number, max: number): number => min + aleatorio() * (max - min);
  const inteiro = (min: number, max: number): number => Math.floor(entre(min, max + 1));
  const sortear = <T>(lista: readonly T[]): T => lista[Math.floor(aleatorio() * lista.length)];
  /** Horário comercial de São Paulo (11h a 20h UTC), para as datas não caírem à meia-noite. */
  const horaComercial = (data: Date): Date => {
    const dia = Math.floor(data.getTime() / MS_DIA) * MS_DIA;
    return new Date(dia + inteiro(11, 20) * MS_HORA + inteiro(0, 59) * 60_000);
  };

  // UTs e usuários ------------------------------------------------------------------------
  const uts: DemoUt[] = [];
  const usuarios: DemoUsuario[] = [];
  const almoxarifePorUt = new Map<string, DemoUsuario>();
  const colaboradorPorUt = new Map<string, DemoUsuario>();

  for (let i = 0; i < QUANTIDADE_UTS; i++) {
    const numero = doisDigitos(i + 1);
    const codigo = `${PREFIXO_UT_DEMO}${numero}`;
    uts.push({ codigo, nome: `UT Demonstração ${numero}`, ...CIDADES[i] });

    for (const [indice, papel] of (["almoxarife", "colaborador"] as const).entries()) {
      const sequencial = i * 2 + indice + 1;
      const usuario: DemoUsuario = {
        id: `demo-usuario-${numero}-${papel}`,
        nome: `${NOMES[(i + indice * 5) % NOMES.length]} ${SOBRENOMES[(i * 7 + indice * 3) % SOBRENOMES.length]} (demo)`,
        email: `demo${numero}.${papel}@demo.msv.local`,
        cpf: cpfComDigitos(`9000000${doisDigitos(sequencial)}`),
        telefone: `(${11 + i}) 9${String(1000 + i * 37).slice(0, 4)}-${String(2000 + sequencial * 53).slice(0, 4)}`,
        papel,
        utCodigo: codigo,
      };
      usuarios.push(usuario);
      (papel === "almoxarife" ? almoxarifePorUt : colaboradorPorUt).set(codigo, usuario);
    }
  }

  // Itens ---------------------------------------------------------------------------------
  // Cadastrados entre ~13 meses e 3 dias atrás, para o histórico de 12 meses ter origem.
  const itens: DemoItem[] = [];
  for (let i = 0; i < QUANTIDADE_ITENS; i++) {
    const modelo = MODELOS[i % MODELOS.length];
    const ut = uts[Math.floor(aleatorio() * uts.length)];
    const quantidadeTotal = inteiro(modelo.quantidade[0], modelo.quantidade[1]);
    const valor = arredondar2(entre(modelo.valor[0], modelo.valor[1]));
    const jitter = (n: number): number => arredondar2(n * entre(0.92, 1.08));
    const [largura, altura, profundidade, peso] = modelo.medidas;
    const criadoEm = horaComercial(new Date(agora.getTime() - entre(3, 395) * MS_DIA));
    const numero = String(i + 1).padStart(3, "0");

    const comLote = quantidadeTotal > 1 && aleatorio() < 0.4;
    itens.push({
      id: `demo-item-${numero}`,
      utCodigo: ut.codigo,
      criadoPorId: almoxarifePorUt.get(ut.codigo)!.id,
      categoria: modelo.categoria,
      segmento: sortear(modelo.segmentos),
      // RM de demonstração: prefixo 99 + sequencial, único e fácil de reconhecer.
      rm: `99${String(i + 1).padStart(6, "0")}`,
      nome: modelo.nome,
      marca: modelo.marca,
      modelo: modelo.modelo,
      descricao: aleatorio() < 0.5 ? sortear(DESCRICOES) : null,
      estado: sortear(ESTADOS),
      unidade: modelo.unidade,
      quantidadeTotal,
      quantidadeDisponivel: quantidadeTotal,
      valorUnitarioReposicao: valor,
      valorDepreciacaoMensal: modelo.categoria === "ativo" ? arredondar2(valor * entre(0.008, 0.02)) : null,
      larguraCm: jitter(largura),
      alturaCm: jitter(altura),
      profundidadeCm: jitter(profundidade),
      pesoKg: jitter(peso),
      lote: comLote
        ? {
            larguraCm: arredondar2(largura * Math.min(quantidadeTotal, 3)),
            alturaCm: arredondar2(altura),
            profundidadeCm: arredondar2(profundidade * Math.ceil(quantidadeTotal / 3)),
            pesoKg: arredondar2(peso * quantidadeTotal),
          }
        : null,
      status: "disponivel",
      criadoEm,
      fotos: [inteiro(0, QUANTIDADE_FOTOS_GENERICAS - 1)],
    });
  }

  // Solicitações concluídas, espalhadas nos últimos 12 meses --------------------------------
  const limiteInferior = agora.getTime() - 350 * MS_DIA;
  const limiteSuperior = agora.getTime() - 1 * MS_DIA;
  const solicitacoes: DemoSolicitacao[] = [];

  let tentativas = 0;
  while (solicitacoes.length < QUANTIDADE_SOLICITACOES && tentativas < 5000) {
    tentativas++;
    const item = sortear(itens);
    if (item.quantidadeDisponivel <= 0 || item.status === "arquivado") continue;

    const criadoEm = new Date(item.criadoEm.getTime() + entre(1 / 24, 45) * MS_DIA);
    const respondidaEm = new Date(criadoEm.getTime() + entre(1, 48) * MS_HORA);
    const concluidaEm = new Date(respondidaEm.getTime() + entre(2, 30) * MS_DIA);
    if (concluidaEm.getTime() > limiteSuperior || concluidaEm.getTime() < limiteInferior) continue;

    const destinos = uts.filter((ut) => ut.codigo !== item.utCodigo);
    const destino = sortear(destinos);
    const origem = uts.find((ut) => ut.codigo === item.utCodigo)!;
    const solicitante = aleatorio() < 0.5 ? colaboradorPorUt.get(destino.codigo)! : almoxarifePorUt.get(destino.codigo)!;

    const maximo = Math.max(1, Math.ceil(item.quantidadeTotal * 0.5));
    const quantidade = Math.min(inteiro(1, maximo), item.quantidadeDisponivel);
    item.quantidadeDisponivel -= quantidade;

    // Frete: base + peso, mais barato dentro do mesmo estado; 1 em 8 é retirada sem custo.
    const pesoTotal = (item.lote?.pesoKg ?? item.pesoKg * quantidade) || item.pesoKg;
    const fator = origem.uf === destino.uf ? 0.6 : 1.4;
    const frete = aleatorio() < 0.125 ? 0 : Math.min(1500, 70 + pesoTotal * 1.6 * fator);

    solicitacoes.push({
      id: `demo-solicitacao-${String(solicitacoes.length + 1).padStart(3, "0")}`,
      itemId: item.id,
      solicitanteId: solicitante.id,
      utDestinoCodigo: destino.codigo,
      respondidaPorId: almoxarifePorUt.get(item.utCodigo)!.id,
      concluidaPorId: solicitante.id,
      quantidade,
      observacao: aleatorio() < 0.6 ? sortear(OBSERVACOES) : null,
      valorUnitarioSnapshot: item.valorUnitarioReposicao,
      custoFrete: Math.round(frete * 2) / 2,
      criadoEm,
      respondidaEm,
      concluidaEm,
    });
  }

  // Status final: esgotado sem unidades; ~5% do que sobrou foi arquivado.
  for (const item of itens) {
    if (item.quantidadeDisponivel === 0) item.status = "esgotado";
    else if (aleatorio() < 0.05) item.status = "arquivado";
  }

  solicitacoes.sort((a, b) => a.concluidaEm.getTime() - b.concluidaEm.getTime());

  return { uts, usuarios, itens, solicitacoes, quantidadeFotosGenericas: QUANTIDADE_FOTOS_GENERICAS };
}
