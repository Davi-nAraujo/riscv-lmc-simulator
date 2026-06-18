/* ============================================================
 *  blocks.js — Os blocos visuais (estilo Scratch) do Blockly
 *
 *  Cada bloco representa uma instrução RISC-V, mas com um nome
 *  amigável em português. Aqui também fica o "tradutor":
 *  montarPrograma() lê os blocos encaixados e devolve a lista
 *  de instruções (a IR) que o machine.js sabe executar.
 * ============================================================ */

// Opções do menu de registradores: x0..x7 (x0 é sempre 0).
const OPCOES_REG = [];
for (let i = 0; i < NUM_REGISTRADORES; i++) {
  OPCOES_REG.push([`x${i}` + (i === 0 ? ' (sempre 0)' : ''), String(i)]);
}

// ---- Definição visual dos blocos (JSON declarativo do Blockly) ----
Blockly.defineBlocksWithJsonArray([
  {
    type: 'riscv_ler_entrada',
    message0: 'in  —  Ler Entrada para a caixa %1',
    args0: [{ type: 'field_dropdown', name: 'RD', options: OPCOES_REG }],
    previousStatement: null, nextStatement: null,
    colour: '#5C81A6',
    tooltip: 'Assembly: in. Lê um número da Entrada para um registrador.',
  },
  {
    type: 'riscv_carregar',
    message0: 'lw  —  Carregar da Memória: armário %1 para a caixa %2',
    args0: [
      { type: 'field_number', name: 'END', value: 0, min: 0, max: NUM_ARMARIOS - 1, precision: 1 },
      { type: 'field_dropdown', name: 'RD', options: OPCOES_REG },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#5C81A6',
    tooltip: 'Assembly: lw (load word). Copia o valor de um armário para um registrador.',
  },
  {
    type: 'riscv_guardar',
    message0: 'sw  —  Guardar na Memória: caixa %1 no armário %2',
    args0: [
      { type: 'field_dropdown', name: 'RS', options: OPCOES_REG },
      { type: 'field_number', name: 'END', value: 0, min: 0, max: NUM_ARMARIOS - 1, precision: 1 },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#5C81A6',
    tooltip: 'Assembly: sw (store word). Copia o valor de um registrador para um armário.',
  },
  {
    type: 'riscv_mostrar_saida',
    message0: 'out  —  Mostrar Saída da caixa %1',
    args0: [{ type: 'field_dropdown', name: 'RS', options: OPCOES_REG }],
    previousStatement: null, nextStatement: null,
    colour: '#5C81A6',
    tooltip: 'Assembly: out. Envia o valor de um registrador para a Saída.',
  },
  {
    type: 'riscv_somar_numero',
    message0: 'addi  —  caixa %1 = caixa %2 + número %3',
    args0: [
      { type: 'field_dropdown', name: 'RD', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS', options: OPCOES_REG },
      { type: 'field_number', name: 'IMM', value: 1, precision: 1 },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#A65C81',
    tooltip: 'Assembly: addi. Soma um número fixo a um registrador.',
  },
  {
    type: 'riscv_somar',
    message0: 'add  —  caixa %1 = caixa %2 + caixa %3',
    args0: [
      { type: 'field_dropdown', name: 'RD', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS1', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS2', options: OPCOES_REG },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#A65C81',
    tooltip: 'Assembly: add. Soma dois registradores.',
  },
  {
    type: 'riscv_subtrair',
    message0: 'sub  —  caixa %1 = caixa %2 - caixa %3',
    args0: [
      { type: 'field_dropdown', name: 'RD', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS1', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS2', options: OPCOES_REG },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#A65C81',
    tooltip: 'Assembly: sub. Subtrai dois registradores.',
  },
  {
    type: 'riscv_pular_se_igual',
    message0: 'beq  —  se caixa %1 = caixa %2, ir para o marcador %3',
    args0: [
      { type: 'field_dropdown', name: 'RS1', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS2', options: OPCOES_REG },
      { type: 'field_input', name: 'ROTULO', text: 'inicio' },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#5CA68D',
    tooltip: 'Assembly: beq. Se os dois registradores forem iguais, desvia o fluxo.',
  },
  {
    type: 'riscv_marcador',
    message0: 'rótulo:  %1',
    args0: [{ type: 'field_input', name: 'NOME', text: 'inicio' }],
    previousStatement: null, nextStatement: null,
    colour: '#5CA68D',
    tooltip: 'Rótulo (label) do assembly. O beq mira neste ponto.',
  },
]);

/* ------------------------------------------------------------
 *  montarPrograma(workspace)
 *  Percorre os blocos encaixados (de cima para baixo) e
 *  transforma cada um numa instrução da IR.
 * ------------------------------------------------------------ */
function montarPrograma(workspace) {
  const programa = [];
  const num = (b, campo) => parseInt(b.getFieldValue(campo), 10);
  const txt = (b, campo) => b.getFieldValue(campo);

  // Pega a 1ª pilha de blocos (ordenada). Ignoramos pilhas soltas extras.
  const topo = workspace.getTopBlocks(true);
  let bloco = topo.length ? topo[0] : null;

  while (bloco) {
    switch (bloco.type) {
      case 'riscv_ler_entrada':
        programa.push({ op: 'LER_ENTRADA', rd: num(bloco, 'RD') });
        break;
      case 'riscv_carregar':
        programa.push({ op: 'CARREGAR', end: num(bloco, 'END'), rd: num(bloco, 'RD') });
        break;
      case 'riscv_guardar':
        programa.push({ op: 'GUARDAR', rs: num(bloco, 'RS'), end: num(bloco, 'END') });
        break;
      case 'riscv_mostrar_saida':
        programa.push({ op: 'MOSTRAR', rs: num(bloco, 'RS') });
        break;
      case 'riscv_somar_numero':
        programa.push({ op: 'SOMAR_NUM', rd: num(bloco, 'RD'), rs: num(bloco, 'RS'), imm: num(bloco, 'IMM') });
        break;
      case 'riscv_somar':
        programa.push({ op: 'SOMAR', rd: num(bloco, 'RD'), rs1: num(bloco, 'RS1'), rs2: num(bloco, 'RS2') });
        break;
      case 'riscv_subtrair':
        programa.push({ op: 'SUBTRAIR', rd: num(bloco, 'RD'), rs1: num(bloco, 'RS1'), rs2: num(bloco, 'RS2') });
        break;
      case 'riscv_pular_se_igual':
        programa.push({ op: 'PULAR_SE_IGUAL', rs1: num(bloco, 'RS1'), rs2: num(bloco, 'RS2'), rotulo: txt(bloco, 'ROTULO') });
        break;
      case 'riscv_marcador':
        programa.push({ op: 'MARCADOR', nome: txt(bloco, 'NOME') });
        break;
    }
    // guarda de qual bloco veio cada instrução, p/ destacar no canvas
    programa[programa.length - 1].blockId = bloco.id;
    bloco = bloco.getNextBlock();
  }
  return programa;
}

window.montarPrograma = montarPrograma;
