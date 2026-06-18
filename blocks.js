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
    message0: 'in   %1',
    args0: [{ type: 'field_dropdown', name: 'RD', options: OPCOES_REG }],
    previousStatement: null, nextStatement: null,
    colour: '#3b6ea5',
    tooltip: 'in rd — lê o próximo valor da Entrada (I/O) para o registrador rd.',
  },
  {
    type: 'riscv_carregar',
    message0: 'lw   %1, MEM[ %2 ]',
    args0: [
      { type: 'field_dropdown', name: 'RD', options: OPCOES_REG },
      { type: 'field_number', name: 'END', value: 0, min: 0, max: NUM_ARMARIOS - 1, precision: 1 },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#3b6ea5',
    tooltip: 'lw rd, MEM[end] — load word: carrega MEM[end] no registrador rd.',
  },
  {
    type: 'riscv_guardar',
    message0: 'sw   %1, MEM[ %2 ]',
    args0: [
      { type: 'field_dropdown', name: 'RS', options: OPCOES_REG },
      { type: 'field_number', name: 'END', value: 0, min: 0, max: NUM_ARMARIOS - 1, precision: 1 },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#3b6ea5',
    tooltip: 'sw rs, MEM[end] — store word: escreve o registrador rs em MEM[end].',
  },
  {
    type: 'riscv_mostrar_saida',
    message0: 'out  %1',
    args0: [{ type: 'field_dropdown', name: 'RS', options: OPCOES_REG }],
    previousStatement: null, nextStatement: null,
    colour: '#3b6ea5',
    tooltip: 'out rs — envia o valor do registrador rs para a Saída (I/O).',
  },
  {
    type: 'riscv_somar_numero',
    message0: 'addi %1, %2, %3',
    args0: [
      { type: 'field_dropdown', name: 'RD', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS', options: OPCOES_REG },
      { type: 'field_number', name: 'IMM', value: 1, precision: 1 },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#a05252',
    tooltip: 'addi rd, rs, imm — rd = rs + imm (soma com imediato, via ULA).',
  },
  {
    type: 'riscv_somar',
    message0: 'add  %1, %2, %3',
    args0: [
      { type: 'field_dropdown', name: 'RD', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS1', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS2', options: OPCOES_REG },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#a05252',
    tooltip: 'add rd, rs1, rs2 — rd = rs1 + rs2 (via ULA).',
  },
  {
    type: 'riscv_subtrair',
    message0: 'sub  %1, %2, %3',
    args0: [
      { type: 'field_dropdown', name: 'RD', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS1', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS2', options: OPCOES_REG },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#a05252',
    tooltip: 'sub rd, rs1, rs2 — rd = rs1 - rs2 (via ULA).',
  },
  {
    type: 'riscv_pular_se_igual',
    message0: 'beq  %1, %2, %3',
    args0: [
      { type: 'field_dropdown', name: 'RS1', options: OPCOES_REG },
      { type: 'field_dropdown', name: 'RS2', options: OPCOES_REG },
      { type: 'field_input', name: 'ROTULO', text: 'inicio' },
    ],
    previousStatement: null, nextStatement: null,
    colour: '#4f8a6d',
    tooltip: 'beq rs1, rs2, label — branch if equal: se rs1 == rs2, o PC desvia para label.',
  },
  {
    type: 'riscv_marcador',
    message0: '%1 :',
    args0: [{ type: 'field_input', name: 'NOME', text: 'inicio' }],
    previousStatement: null, nextStatement: null,
    colour: '#4f8a6d',
    tooltip: 'label: — rótulo. Marca uma posição no programa, alvo de beq. Não gera instrução.',
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
