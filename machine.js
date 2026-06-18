/* ============================================================
 *  machine.js — O motor lógico (a "mente" do computador)
 *
 *  MachineState guarda TODO o estado do computador:
 *    - registradores (as "Caixas de Mão")
 *    - memória       (os "Armários")
 *    - pc            (o "Contador", qual ordem vem a seguir)
 *    - inbox / outbox (Entrada e Saída)
 *
 *  Cada instrução, ao executar, NÃO desenha nada na tela.
 *  Ela só altera o estado e devolve uma lista de "fases" —
 *  pedacinhos da animação que o app.js vai mostrar com calma,
 *  um de cada vez, no modo Passo a Passo.
 * ============================================================ */

const NUM_REGISTRADORES = 8;   // x0..x7  (x0 é sempre 0, como no RISC-V real)
const NUM_ARMARIOS      = 24;  // memória de dados (0..23)

class MachineState {
  constructor() {
    this.reset();
  }

  reset() {
    this.registradores = new Array(NUM_REGISTRADORES).fill(0);
    this.memoria       = new Array(NUM_ARMARIOS).fill(0);
    this.pc            = 0;
    this.inbox         = [];
    this.outbox        = [];
    this.programa      = [];   // lista de instruções (a IR montada pelos blocos)
    this.rotulos       = {};   // nome do marcador -> índice da instrução
    this.parado        = true;
  }

  /* Carrega um programa (vetor de instruções) e resolve os marcadores. */
  carregarPrograma(programa) {
    this.reset();
    this.programa = programa;
    this.parado   = programa.length === 0;
    // 1ª passada: mapear os marcadores (rótulos) para posições
    programa.forEach((instr, i) => {
      if (instr.op === 'MARCADOR') this.rotulos[instr.nome] = i;
    });
  }

  /* Coloca números na caixa de entrada (Inbox). */
  definirEntrada(valores) { this.inbox = valores.slice(); }

  /* Lê um registrador respeitando a regra: x0 sempre vale 0. */
  reg(i) { return i === 0 ? 0 : this.registradores[i]; }

  /* Escreve num registrador (ignora escrita em x0). */
  setReg(i, v) { if (i !== 0) this.registradores[i] = v | 0; }

  acabou() { return this.parado || this.pc >= this.programa.length; }

  /* ----------------------------------------------------------
   *  executarPasso(): executa UMA instrução.
   *  Devolve { fases: [...] } descrevendo a animação.
   *  Cada fase = { focos: [ids p/ acender], narra: texto, faz: fn }
   *  app.js acende os 'focos', mostra 'narra' e chama 'faz()'
   *  (que é o momento em que o valor realmente muda).
   * ---------------------------------------------------------- */
  executarPasso() {
    if (this.acabou()) { this.parado = true; return { fases: [], fim: true }; }

    const instr   = this.programa[this.pc];
    const proxPc  = this.pc + 1;
    let saltouPara = null;          // se a instrução desviar o fluxo
    const fases   = [];

    // Fase 0: o Contador aponta para a ordem atual ("buscar instrução")
    fases.push({
      focos: ['#pc-box'],
      narra: `O Contador aponta para a ordem nº ${this.pc}. Vamos buscá-la.`,
    });

    switch (instr.op) {
      /* ---- Ler Entrada (Inbox -> registrador) ---- */
      case 'LER_ENTRADA': {
        const v = this.inbox.length ? this.inbox[0] : 0;
        fases.push({
          focos: ['#inbox', `#reg-${instr.rd}`],
          narra: `LER ENTRADA: pego o número ${v} da caixa de entrada e ` +
                 `coloco na caixa de mão x${instr.rd}.`,
          faz: () => { this.inbox.shift(); this.setReg(instr.rd, v); },
        });
        break;
      }

      /* ---- Carregar da Memória (LW: armário -> registrador) ---- */
      case 'CARREGAR': {
        const v = this.memoria[instr.end];
        fases.push({
          focos: [`#mem-${instr.end}`, `#reg-${instr.rd}`],
          narra: `CARREGAR: abro o armário ${instr.end} (vale ${v}) e copio ` +
                 `esse número para a caixa de mão x${instr.rd}.`,
          faz: () => this.setReg(instr.rd, v),
        });
        break;
      }

      /* ---- Guardar na Memória (SW: registrador -> armário) ---- */
      case 'GUARDAR': {
        const v = this.reg(instr.rs);
        fases.push({
          focos: [`#reg-${instr.rs}`, `#mem-${instr.end}`],
          narra: `GUARDAR: pego o número ${v} da caixa de mão x${instr.rs} ` +
                 `e o tranco no armário ${instr.end}.`,
          faz: () => { this.memoria[instr.end] = v; },
        });
        break;
      }

      /* ---- Mostrar Saída (registrador -> Outbox) ---- */
      case 'MOSTRAR': {
        const v = this.reg(instr.rs);
        fases.push({
          focos: [`#reg-${instr.rs}`, '#outbox'],
          narra: `MOSTRAR: levo o número ${v} da caixa de mão x${instr.rs} ` +
                 `até a caixa de saída para todos verem.`,
          faz: () => this.outbox.push(v),
        });
        break;
      }

      /* ---- Somar Número (ADDI: registrador + número fixo) ---- */
      case 'SOMAR_NUM': {
        const a = this.reg(instr.rs);
        const r = a + instr.imm;
        fases.push({
          focos: [`#reg-${instr.rs}`, '#ula-box'],
          narra: `SOMAR NÚMERO: levo o ${a} (de x${instr.rs}) até a Calculadora ` +
                 `para somar com o número ${instr.imm}.`,
          ula: `${a} + ${instr.imm}`,
        });
        fases.push({
          focos: ['#ula-box', `#reg-${instr.rd}`],
          narra: `A Calculadora dá ${r}. Guardo o resultado na caixa x${instr.rd}.`,
          ula: `= ${r}`,
          faz: () => this.setReg(instr.rd, r),
        });
        break;
      }

      /* ---- Somar (ADD: registrador + registrador) ---- */
      case 'SOMAR': {
        const a = this.reg(instr.rs1), b = this.reg(instr.rs2);
        const r = a + b;
        fases.push({
          focos: [`#reg-${instr.rs1}`, `#reg-${instr.rs2}`, '#ula-box'],
          narra: `SOMAR: levo o ${a} (x${instr.rs1}) e o ${b} (x${instr.rs2}) ` +
                 `até a Calculadora.`,
          ula: `${a} + ${b}`,
        });
        fases.push({
          focos: ['#ula-box', `#reg-${instr.rd}`],
          narra: `A Calculadora dá ${r}. Guardo na caixa x${instr.rd}.`,
          ula: `= ${r}`,
          faz: () => this.setReg(instr.rd, r),
        });
        break;
      }

      /* ---- Subtrair (SUB) ---- */
      case 'SUBTRAIR': {
        const a = this.reg(instr.rs1), b = this.reg(instr.rs2);
        const r = a - b;
        fases.push({
          focos: [`#reg-${instr.rs1}`, `#reg-${instr.rs2}`, '#ula-box'],
          narra: `SUBTRAIR: levo o ${a} (x${instr.rs1}) e o ${b} (x${instr.rs2}) ` +
                 `até a Calculadora.`,
          ula: `${a} - ${b}`,
        });
        fases.push({
          focos: ['#ula-box', `#reg-${instr.rd}`],
          narra: `A Calculadora dá ${r}. Guardo na caixa x${instr.rd}.`,
          ula: `= ${r}`,
          faz: () => this.setReg(instr.rd, r),
        });
        break;
      }

      /* ---- Pular se Igual (BEQ) ---- */
      case 'PULAR_SE_IGUAL': {
        const a = this.reg(instr.rs1), b = this.reg(instr.rs2);
        const igual = a === b;
        const destino = this.rotulos[instr.rotulo];
        if (igual && destino !== undefined) saltouPara = destino;
        fases.push({
          focos: [`#reg-${instr.rs1}`, `#reg-${instr.rs2}`, '#ula-box'],
          narra: `PULAR SE IGUAL: comparo x${instr.rs1} (${a}) com x${instr.rs2} (${b}). ` +
                 (igual
                   ? `São iguais! O Contador vai pular para o marcador "${instr.rotulo}".`
                   : `São diferentes. Sigo para a próxima ordem normalmente.`),
          ula: `${a} ${igual ? '==' : '!='} ${b}`,
        });
        break;
      }

      /* ---- Marcador (rótulo, só uma plaquinha; não faz nada) ---- */
      case 'MARCADOR': {
        fases.push({
          focos: [],
          narra: `Marcador "${instr.nome}": é só uma placa de referência. Sigo em frente.`,
        });
        break;
      }

      default:
        fases.push({ focos: [], narra: `Ordem desconhecida (${instr.op}).` });
    }

    // Fase final: avançar o Contador
    fases.push({
      focos: ['#pc-box'],
      narra: saltouPara !== null
        ? `O Contador pula para a ordem nº ${saltouPara}.`
        : `O Contador avança para a ordem nº ${proxPc}.`,
      faz: () => { this.pc = (saltouPara !== null) ? saltouPara : proxPc; },
    });

    return { fases, fim: false };
  }
}

// Disponibiliza globalmente (estamos sem módulos/bundler, tudo no navegador)
window.MachineState = MachineState;
window.NUM_REGISTRADORES = NUM_REGISTRADORES;
window.NUM_ARMARIOS = NUM_ARMARIOS;
