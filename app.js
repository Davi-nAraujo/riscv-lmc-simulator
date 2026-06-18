/* ============================================================
 *  app.js — A camada que liga tudo:
 *   - inicia o editor Blockly
 *   - desenha o painel de estado do processador
 *   - anima o fluxo de dados, fase por fase
 *   - controla Passo / Executar tudo / Reiniciar
 * ============================================================ */

const maquina = new MachineState();
let workspace = null;
let animando  = false;   // trava p/ não sobrepor animações
let programaCarregado = false;

/* Tema escuro do Blockly, para combinar com o painel do simulador. */
const TEMA_RISCV = Blockly.Theme.defineTheme('riscv-dark', {
  base: Blockly.Themes.Classic,
  componentStyles: {
    workspaceBackgroundColour: '#0d1117',
    toolboxBackgroundColour: '#161b22',
    toolboxForegroundColour: '#e6edf3',
    flyoutBackgroundColour: '#161b22',
    flyoutForegroundColour: '#8b949e',
    flyoutOpacity: 1,
    scrollbarColour: '#364150',
    insertionMarkerColour: '#58a6ff',
    insertionMarkerOpacity: 0.4,
    cursorColour: '#58a6ff',
    selectedGlowColour: '#58a6ff',
  },
  fontStyle: { family: 'JetBrains Mono, monospace', size: 11 },
});

/* ---------- 1. Inicia o Blockly ---------- */
function iniciarBlockly() {
  workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox'),
    theme: TEMA_RISCV,
    scrollbars: true,
    trashcan: true,
    grid: { spacing: 22, length: 3, colour: '#21262d', snap: true },
    zoom: { controls: true, wheel: true, startScale: 0.95 },
  });
  carregarExemplo();
}

/* Um programinha de exemplo: lê 2 números, soma e mostra. */
function carregarExemplo() {
  const xml = `
    <xml>
      <block type="riscv_ler_entrada"><field name="RD">1</field><next>
      <block type="riscv_ler_entrada"><field name="RD">2</field><next>
      <block type="riscv_somar">
        <field name="RD">3</field><field name="RS1">1</field><field name="RS2">2</field>
      <next>
      <block type="riscv_mostrar_saida"><field name="RS">3</field></block>
      </next></block></next></block></next></block>
    </xml>`;
  const dom = Blockly.utils.xml.textToDom(xml);
  Blockly.Xml.domToWorkspace(dom, workspace);
}

/* ---------- 2. Desenha o painel de estado (componentes fixos) ---------- */
function montarPaineis() {
  // Registradores x0..x7
  const reg = document.getElementById('reg-grid');
  reg.innerHTML = '';
  for (let i = 0; i < NUM_REGISTRADORES; i++) {
    reg.insertAdjacentHTML('beforeend', `
      <div class="reg-cel${i === 0 ? ' reg-zero' : ''}" id="reg-${i}">
        <div class="reg-nome">x${i}</div>
        <div class="reg-valor" id="reg-${i}-v">0</div>
      </div>`);
  }
  // Memória de dados MEM[0..23]
  const mem = document.getElementById('mem-grid');
  mem.innerHTML = '';
  for (let i = 0; i < NUM_ARMARIOS; i++) {
    mem.insertAdjacentHTML('beforeend', `
      <div class="mem-cel" id="mem-${i}">
        <div class="mem-end">${i}</div>
        <div class="mem-valor" id="mem-${i}-v">0</div>
      </div>`);
  }
}

/* Atualiza os VALORES na tela a partir do estado da máquina,
   sem destruir os elementos (para não perder os destaques). */
function atualizarValores() {
  document.getElementById('pc-valor').textContent = maquina.pc;
  for (let i = 0; i < NUM_REGISTRADORES; i++)
    document.getElementById(`reg-${i}-v`).textContent = maquina.reg(i);
  for (let i = 0; i < NUM_ARMARIOS; i++)
    document.getElementById(`mem-${i}-v`).textContent = maquina.memoria[i];

  const fichas = (arr) => arr.map(v => `<span class="io-ficha">${v}</span>`).join('');
  document.getElementById('inbox').innerHTML  = fichas(maquina.inbox);
  document.getElementById('outbox').innerHTML = fichas(maquina.outbox);
}

/* ---------- 3. Motor de animação ---------- */
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
const velocidade = () => parseInt(document.getElementById('velocidade').value, 10);
const narrar = (txt) => { document.getElementById('narrador').textContent = txt; };

function limparDestaques() {
  document.querySelectorAll('.ativo').forEach(el => el.classList.remove('ativo'));
}

async function animarFase(fase) {
  limparDestaques();
  (fase.focos || []).forEach(sel => {
    const el = document.querySelector(sel);
    if (el) { el.classList.add('ativo'); el.classList.add('pulso');
      setTimeout(() => el.classList.remove('pulso'), 400); }
  });
  if (fase.ula) document.getElementById('ula-visor').textContent = fase.ula;
  narrar(fase.narra);
  await esperar(velocidade());
  if (fase.faz) { fase.faz(); atualizarValores(); }   // o valor muda AGORA
}

/* Garante que o programa atual dos blocos esteja carregado na máquina. */
function garantirPrograma() {
  if (programaCarregado && !maquina.acabou()) return true;
  const programa = montarPrograma(workspace);
  if (programa.length === 0) {
    narrar('Programa vazio. Arraste instruções para o editor primeiro.');
    return false;
  }
  maquina.carregarPrograma(programa);
  // Entrada de exemplo: dois valores aguardando no inbox da I/O.
  maquina.definirEntrada([7, 5]);
  // Algumas posições de memória pré-carregadas, para o lw ter o que ler.
  maquina.memoria[10] = 42; maquina.memoria[11] = 8;
  atualizarValores();
  programaCarregado = true;
  return true;
}

/* Executa UMA instrução (com todas as suas fases animadas). */
async function passo() {
  if (animando) return;
  if (!garantirPrograma()) return;
  if (maquina.acabou()) { narrar('Execução concluída. Clique em Reiniciar para rodar novamente.'); return; }

  animando = true;
  const idAtual = maquina.programa[maquina.pc]?.blockId;
  if (idAtual) { try { workspace.highlightBlock(idAtual); } catch (_) {} }

  const { fases, fim } = maquina.executarPasso();
  for (const fase of fases) await animarFase(fase);

  try { workspace.highlightBlock(null); } catch (_) {}
  limparDestaques();
  if (maquina.acabou()) narrar('Execução concluída. Clique em Reiniciar para rodar novamente.');
  animando = false;
  return fim;
}

/* Roda tudo: vai dando passos até acabar. */
async function rodarTudo() {
  if (animando) return;
  if (!garantirPrograma()) return;
  while (!maquina.acabou()) {
    await passo();
    await esperar(120);
  }
}

/* Reinicia: limpa o estado mas mantém os blocos. */
function reiniciar() {
  animando = false;
  programaCarregado = false;
  maquina.reset();
  limparDestaques();
  document.getElementById('ula-visor').textContent = '—';
  try { workspace.highlightBlock(null); } catch (_) {}
  atualizarValores();
  narrar('Estado reiniciado. Clique em "Passo" para começar.');
}

/* ---------- 4. Dicionário de Assembly ---------- */
const DICIONARIO = [
  ['in',   'rd',              'Lê o próximo valor da Entrada (I/O) e escreve no registrador rd.'],
  ['lw',   'rd, MEM[end]',    'Load word: carrega o conteúdo da posição end da memória no registrador rd.'],
  ['sw',   'rs, MEM[end]',    'Store word: escreve o valor do registrador rs na posição end da memória.'],
  ['out',  'rs',              'Envia o valor do registrador rs para a Saída (I/O).'],
  ['addi', 'rd, rs, imm',     'Soma o imediato imm ao registrador rs: rd = rs + imm (operação da ULA).'],
  ['add',  'rd, rs1, rs2',    'rd = rs1 + rs2, calculado pela ULA.'],
  ['sub',  'rd, rs1, rs2',    'rd = rs1 − rs2, calculado pela ULA.'],
  ['beq',  'rs1, rs2, label', 'Branch if equal: se rs1 == rs2, o PC desvia para label; senão, segue em sequência.'],
  ['label', ':',              'Rótulo. Marca uma posição no programa, alvo de beq. Não gera instrução.'],
];
function montarDicionario() {
  const div = document.getElementById('dicionario');
  div.innerHTML = DICIONARIO.map(([mn, args, desc]) =>
    `<div class="dic-item">
       <span class="dic-sintaxe"><span class="mn">${mn}</span> ${args}</span>
       <span class="dic-desc">${desc}</span>
     </div>`).join('');
}

/* ---------- 5. Liga os botões e inicia ---------- */
window.addEventListener('load', () => {
  iniciarBlockly();
  montarPaineis();
  montarDicionario();
  atualizarValores();
  document.getElementById('btn-passo').addEventListener('click', passo);
  document.getElementById('btn-rodar').addEventListener('click', rodarTudo);
  document.getElementById('btn-reset').addEventListener('click', reiniciar);
});
