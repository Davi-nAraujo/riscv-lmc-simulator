/* ============================================================
 *  examples.js — Desafios propostos + suas soluções
 *
 *  Cada desafio traz:
 *    - o enunciado (o problema para a pessoa tentar sozinha)
 *    - o cenário inicial (entrada na I/O e memória pré-carregada)
 *    - a solução, como lista de instruções, revelada só sob demanda
 *
 *  programaXml() converte a lista de instruções na XML que o
 *  Blockly entende, montando a pilha de blocos encaixados.
 * ============================================================ */

/* Constrói a XML de uma pilha de blocos a partir de uma lista
   [{ tipo, campos }] em ordem de cima para baixo. */
function programaXml(lista) {
  let xml = '';
  lista.forEach((b, i) => {
    const campos = Object.entries(b.campos || {})
      .map(([k, v]) => `<field name="${k}">${v}</field>`).join('');
    xml += `<block type="${b.tipo}">${campos}`;
    if (i < lista.length - 1) xml += '<next>';
  });
  for (let i = lista.length - 1; i >= 0; i--) {
    xml += '</block>';
    if (i > 0) xml += '</next>';
  }
  return `<xml>${xml}</xml>`;
}

// Atalhos para descrever instruções de forma compacta.
const _in  = (rd)            => ({ tipo: 'riscv_ler_entrada',   campos: { RD: rd } });
const _lw  = (rd, end)       => ({ tipo: 'riscv_carregar',      campos: { RD: rd, END: end } });
const _sw  = (rs, end)       => ({ tipo: 'riscv_guardar',       campos: { RS: rs, END: end } });
const _out = (rs)            => ({ tipo: 'riscv_mostrar_saida', campos: { RS: rs } });
const _addi= (rd, rs, imm)   => ({ tipo: 'riscv_somar_numero',  campos: { RD: rd, RS: rs, IMM: imm } });
const _add = (rd, rs1, rs2)  => ({ tipo: 'riscv_somar',         campos: { RD: rd, RS1: rs1, RS2: rs2 } });
const _sub = (rd, rs1, rs2)  => ({ tipo: 'riscv_subtrair',      campos: { RD: rd, RS1: rs1, RS2: rs2 } });
const _beq = (rs1, rs2, lbl) => ({ tipo: 'riscv_pular_se_igual',campos: { RS1: rs1, RS2: rs2, ROTULO: lbl } });
const _lbl = (nome)          => ({ tipo: 'riscv_marcador',      campos: { NOME: nome } });

const DESAFIOS = [
  {
    titulo: '1 · Soma de dois números',
    enunciado: 'Leia dois números da Entrada, some-os e envie o resultado para a Saída.',
    dica: 'Use dois in, depois add e por fim out.',
    entrada: [7, 5],
    memoria: {},
    esperado: 'Saída: 12',
    solucao: [ _in(1), _in(2), _add(3, 1, 2), _out(3) ],
  },
  {
    titulo: '2 · Dobro de um número',
    enunciado: 'Leia um número e envie o dobro dele para a Saída.',
    dica: 'Não existe "multiplicar", mas somar um número com ele mesmo dá o dobro.',
    entrada: [9],
    memoria: {},
    esperado: 'Saída: 18',
    solucao: [ _in(1), _add(2, 1, 1), _out(2) ],
  },
  {
    titulo: '3 · Diferença (a − b)',
    enunciado: 'Leia dois números, a e depois b, e envie a − b para a Saída.',
    dica: 'A ordem importa: o primeiro in é a, o segundo é b. Use sub.',
    entrada: [10, 4],
    memoria: {},
    esperado: 'Saída: 6',
    solucao: [ _in(1), _in(2), _sub(3, 1, 2), _out(3) ],
  },
  {
    titulo: '4 · Memória: ler, alterar, guardar',
    enunciado: 'A posição MEM[10] já contém um valor. Carregue-o, some 100, ' +
               'guarde o resultado de volta em MEM[10] e mostre-o na Saída.',
    dica: 'lw traz da memória para um registrador; sw leva de volta. addi soma o 100.',
    entrada: [],
    memoria: { 10: 42 },
    esperado: 'Saída: 142 · MEM[10] passa a valer 142',
    solucao: [ _lw(1, 10), _addi(1, 1, 100), _sw(1, 10), _out(1) ],
  },
  {
    titulo: '5 · Laço com beq: contagem regressiva',
    enunciado: 'Leia um número N e mostre na Saída a contagem de N até 0 ' +
               '(N, N−1, …, 1, 0). Repita usando um rótulo e beq.',
    dica: 'Mostre o contador, teste com "beq contador, x0, fim". Se não acabou, ' +
          'faça addi contador, contador, -1 e volte ao rótulo com "beq x0, x0, loop" ' +
          '(x0 é sempre 0, então esse beq é um salto incondicional).',
    entrada: [4],
    memoria: {},
    esperado: 'Saída: 4, 3, 2, 1, 0',
    solucao: [
      _in(1),
      _lbl('loop'),
      _out(1),
      _beq(1, 0, 'fim'),
      _addi(1, 1, -1),
      _beq(0, 0, 'loop'),
      _lbl('fim'),
    ],
  },
  {
    titulo: '6 · Laço com beq: soma de 1 até N',
    enunciado: 'Leia um número N e envie para a Saída a soma 1 + 2 + … + N.',
    dica: 'Use um acumulador (um registrador começa em 0) e um contador. A cada ' +
          'volta do laço, some o contador ao acumulador e diminua o contador em 1, ' +
          'até ele chegar a 0; aí mostre o acumulador.',
    entrada: [5],
    memoria: {},
    esperado: 'Saída: 15',
    solucao: [
      _in(1),               // x1 = N (contador)
      _lbl('loop'),
      _beq(1, 0, 'fim'),    // contador == 0? termina
      _add(2, 2, 1),        // soma += contador  (x2 começa em 0)
      _addi(1, 1, -1),      // contador -= 1
      _beq(0, 0, 'loop'),   // salto incondicional
      _lbl('fim'),
      _out(2),              // mostra a soma
    ],
  },
];

window.DESAFIOS = DESAFIOS;
window.programaXml = programaXml;
