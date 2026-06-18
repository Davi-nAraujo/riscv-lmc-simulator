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
let desafioAtual = 0;
let cenarioAtual = { entrada: [], memoria: {} };   // I/O + memória do desafio atual

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
}

/* ---------- Desafios ---------- */

/* Preenche o seletor de desafios. */
function montarSeletorDesafios() {
  const sel = document.getElementById('sel-desafio');
  sel.innerHTML = DESAFIOS.map((d, i) => `<option value="${i}">${d.titulo}</option>`).join('');
  sel.addEventListener('change', () => selecionarDesafio(parseInt(sel.value, 10)));
}

/* Carrega o cenário (entrada da I/O + memória) do desafio na máquina,
   sem nenhum programa — só para a pessoa ver os dados de partida. */
function prepararCenario() {
  maquina.reset();
  maquina.definirEntrada(cenarioAtual.entrada);
  Object.entries(cenarioAtual.memoria).forEach(([e, v]) => { maquina.memoria[+e] = v; });
  programaCarregado = false;
  animando = false;
  limparDestaques();
  document.getElementById('ula-visor').textContent = '—';
  try { workspace.highlightBlock(null); } catch (_) {}
  atualizarValores();
}

/* Lê o campo de edição da Entrada e devolve só os inteiros válidos. */
function lerInboxEditado() {
  return document.getElementById('inbox-edit').value
    .split(/[\s,]+/)
    .filter(s => /^-?\d+$/.test(s))
    .map(Number);
}

/* Aplica os valores digitados na Entrada e reprepara o cenário. */
function aplicarInboxEditado() {
  cenarioAtual.entrada = lerInboxEditado();
  document.getElementById('inbox-edit').value = cenarioAtual.entrada.join(', ');
  prepararCenario();
  narrar('Entrada atualizada. Clique em "Passo" para executar com os novos valores.');
}

/* Define o valor inicial de uma posição de memória e reprepara o cenário. */
function aplicarMemoriaEditada(end, el) {
  const v = /^-?\d+$/.test(el.value.trim()) ? parseInt(el.value, 10) : 0;
  cenarioAtual.memoria[end] = v;
  prepararCenario();   // reaplica o cenário (inclui o novo valor) e atualiza a tela
  narrar(`MEM[${end}] definido como ${v}. Clique em "Passo" para executar.`);
}

/* Seleciona um desafio: mostra o enunciado e prepara o editor.
   comSolucao=true já revela a solução (usado na demonstração inicial). */
function selecionarDesafio(idx, { comSolucao = false } = {}) {
  desafioAtual = idx;
  const d = DESAFIOS[idx];
  cenarioAtual = { entrada: d.entrada.slice(), memoria: { ...d.memoria } };
  document.getElementById('sel-desafio').value = String(idx);
  document.getElementById('inbox-edit').value = d.entrada.join(', ');
  document.getElementById('desafio-enunciado').textContent = d.enunciado;
  document.getElementById('desafio-esperado').textContent = 'Esperado — ' + d.esperado;
  workspace.clear();
  if (comSolucao) {
    carregarSolucao();
  } else {
    prepararCenario();
    narrar(d.dica ? ('Tente montar você mesmo. Dica: ' + d.dica)
                  : 'Monte seu programa e clique em "Passo".');
  }
}

/* Revela a solução do desafio atual no editor. */
function carregarSolucao() {
  const d = DESAFIOS[desafioAtual];
  workspace.clear();
  const dom = Blockly.utils.xml.textToDom(programaXml(d.solucao));
  Blockly.Xml.domToWorkspace(dom, workspace);
  prepararCenario();
  narrar('Solução carregada. Clique em "Passo" ou "Executar tudo" para acompanhar.');
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
  // Memória de dados MEM[0..23] — valores editáveis
  const mem = document.getElementById('mem-grid');
  mem.innerHTML = '';
  for (let i = 0; i < NUM_ARMARIOS; i++) {
    mem.insertAdjacentHTML('beforeend', `
      <div class="mem-cel" id="mem-${i}">
        <div class="mem-end">${i}</div>
        <input class="mem-valor mem-input" id="mem-${i}-v" data-end="${i}"
               inputmode="numeric" value="0"
               title="Valor inicial de MEM[${i}] — clique para editar" />
      </div>`);
  }
  // Edição de qualquer célula de memória (delegação de evento).
  mem.addEventListener('change', (e) => {
    if (e.target.classList.contains('mem-input'))
      aplicarMemoriaEditada(parseInt(e.target.dataset.end, 10), e.target);
  });
}

/* Atualiza os VALORES na tela a partir do estado da máquina,
   sem destruir os elementos (para não perder os destaques). */
function atualizarValores() {
  document.getElementById('pc-valor').textContent = maquina.pc;
  for (let i = 0; i < NUM_REGISTRADORES; i++)
    document.getElementById(`reg-${i}-v`).textContent = maquina.reg(i);
  for (let i = 0; i < NUM_ARMARIOS; i++) {
    const el = document.getElementById(`mem-${i}-v`);
    if (el !== document.activeElement) el.value = maquina.memoria[i];   // não atrapalha a digitação
  }

  const fichas = (arr) => arr.map(v => `<span class="io-ficha">${v}</span>`).join('');
  document.getElementById('inbox').innerHTML  = fichas(maquina.inbox);
  document.getElementById('outbox').innerHTML = fichas(maquina.outbox);
}

/* ---------- 3. Motor de animação ---------- */
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
// O slider representa velocidade: à direita = mais rápido. Convertemos para
// tempo de espera invertendo dentro da faixa (min + max = 1800).
const velocidade = () => 1800 - parseInt(document.getElementById('velocidade').value, 10);
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
  // Cenário do desafio atual: entrada da I/O e memória pré-carregada.
  maquina.definirEntrada(cenarioAtual.entrada);
  Object.entries(cenarioAtual.memoria).forEach(([e, v]) => { maquina.memoria[+e] = v; });
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

/* Reinicia: limpa o estado (recarrega o cenário) mas mantém os blocos. */
function reiniciar() {
  prepararCenario();
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
  montarSeletorDesafios();
  selecionarDesafio(0, { comSolucao: true });   // demo inicial: 1º desafio resolvido
  document.getElementById('btn-passo').addEventListener('click', passo);
  document.getElementById('btn-rodar').addEventListener('click', rodarTudo);
  document.getElementById('btn-reset').addEventListener('click', reiniciar);
  document.getElementById('btn-tentar').addEventListener('click', () => selecionarDesafio(desafioAtual));
  document.getElementById('btn-solucao').addEventListener('click', carregarSolucao);
  document.getElementById('inbox-edit').addEventListener('change', aplicarInboxEditado);
});
