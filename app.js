/* ============================================================
 *  app.js — A "cola" que liga tudo:
 *   - inicia o Blockly
 *   - desenha a Cidade do Computador (painel LMC)
 *   - anima o fluxo de dados, fase por fase
 *   - controla Passo a Passo / Rodar Tudo / Reiniciar
 * ============================================================ */

const maquina = new MachineState();
let workspace = null;
let animando  = false;   // trava p/ não sobrepor animações
let programaCarregado = false;

/* ---------- 1. Inicia o Blockly ---------- */
function iniciarBlockly() {
  workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox'),
    scrollbars: true,
    trashcan: true,
    grid: { spacing: 22, length: 3, colour: '#e5e7eb', snap: true },
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

/* ---------- 2. Desenha a Cidade (painéis fixos) ---------- */
function montarPaineis() {
  // Registradores (Caixas de Mão)
  const reg = document.getElementById('reg-grid');
  reg.innerHTML = '';
  for (let i = 0; i < NUM_REGISTRADORES; i++) {
    reg.insertAdjacentHTML('beforeend', `
      <div class="reg-cel" id="reg-${i}">
        <div class="reg-nome">x${i}</div>
        <div class="reg-valor" id="reg-${i}-v">0</div>
      </div>`);
  }
  // Memória (Armários)
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
    narrar('Seu programa está vazio. Arraste alguns blocos primeiro!');
    return false;
  }
  maquina.carregarPrograma(programa);
  // Entrada de exemplo: dois números esperando na caixa de entrada.
  maquina.definirEntrada([7, 5]);
  // Alguns armários já vêm com valores, para o "Carregar" ter o que mostrar.
  maquina.memoria[10] = 42; maquina.memoria[11] = 8;
  atualizarValores();
  programaCarregado = true;
  return true;
}

/* Executa UMA instrução (com todas as suas fases animadas). */
async function passo() {
  if (animando) return;
  if (!garantirPrograma()) return;
  if (maquina.acabou()) { narrar('Programa terminado. Clique em Reiniciar para rodar de novo.'); return; }

  animando = true;
  const idAtual = maquina.programa[maquina.pc]?.blockId;
  if (idAtual) { try { workspace.highlightBlock(idAtual); } catch (_) {} }

  const { fases, fim } = maquina.executarPasso();
  for (const fase of fases) await animarFase(fase);

  try { workspace.highlightBlock(null); } catch (_) {}
  limparDestaques();
  if (maquina.acabou()) narrar('Programa terminado. Clique em Reiniciar para rodar de novo.');
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
  narrar('Reiniciado. Clique em "Passo a Passo" para começar.');
}

/* ---------- 4. Glossário interativo ---------- */
const GLOSSARIO = [
  ['in', 'Ler Entrada: pega o próximo número da caixa de Entrada e coloca numa caixa de mão (registrador).'],
  ['lw', 'Carregar da Memória: abre um armário e copia o número dele para uma caixa de mão.'],
  ['sw', 'Guardar na Memória: pega o número de uma caixa de mão e tranca dentro de um armário.'],
  ['add / sub', 'Somar / Subtrair: leva dois valores até a Calculadora (ULA) e guarda o resultado numa caixa.'],
  ['addi', 'Somar Número: soma um número fixo (que você digita no bloco) a uma caixa.'],
  ['beq', 'Pular se Igual: compara duas caixas. Se forem iguais, o Contador (PC) pula para um rótulo.'],
  ['out', 'Mostrar Saída: leva o número de uma caixa até a caixa de Saída para você ver o resultado.'],
];
function montarGlossario() {
  const div = document.getElementById('glossario');
  div.innerHTML = GLOSSARIO.map(([n, d]) =>
    `<div class="gloss-item"><span class="gloss-nome">${n}:</span> ${d}</div>`).join('');
}

/* ---------- 5. Liga os botões e inicia ---------- */
window.addEventListener('load', () => {
  iniciarBlockly();
  montarPaineis();
  montarGlossario();
  atualizarValores();
  document.getElementById('btn-passo').addEventListener('click', passo);
  document.getElementById('btn-rodar').addEventListener('click', rodarTudo);
  document.getElementById('btn-reset').addEventListener('click', reiniciar);
});
