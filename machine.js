/* ============================================================
 *  machine.js — O motor lógico do processador
 *
 *  MachineState guarda TODO o estado da máquina:
 *    - registradores  (x0..x7)
 *    - memória        (MEM[0..23])
 *    - pc             (Program Counter: próxima instrução)
 *    - inbox / outbox (Entrada e Saída — I/O)
 *
 *  Cada instrução, ao executar, NÃO desenha nada na tela.
 *  Ela só altera o estado e devolve uma lista de "fases" —
 *  passos da animação que o app.js mostra um a um, no modo Passo.
 * ============================================================ */

const NUM_REGISTRADORES = 8;   // x0..x7  (x0 é sempre 0, como no RISC-V real)
const NUM_ARMARIOS      = 24;  // memória de dados MEM[0..23]

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

    // Fase 0: busca da instrução — o PC indica o endereço atual (fetch)
    fases.push({
      focos: ['#pc-box'],
      narra: `Busca (fetch): o PC = ${this.pc} aponta para a instrução atual.`,
    });

    switch (instr.op) {
      /* ---- in: Entrada (I/O) -> registrador ---- */
      case 'LER_ENTRADA': {
        const v = this.inbox.length ? this.inbox[0] : 0;
        fases.push({
          focos: ['#inbox', `#reg-${instr.rd}`],
          narra: `in x${instr.rd}: lê ${v} da Entrada (I/O) e escreve em x${instr.rd}.`,
          faz: () => { this.inbox.shift(); this.setReg(instr.rd, v); },
        });
        break;
      }

      /* ---- lw: memória -> registrador (load word) ---- */
      case 'CARREGAR': {
        const v = this.memoria[instr.end];
        fases.push({
          focos: [`#mem-${instr.end}`, `#reg-${instr.rd}`],
          narra: `lw x${instr.rd}, MEM[${instr.end}]: carrega MEM[${instr.end}] = ${v} em x${instr.rd}.`,
          faz: () => this.setReg(instr.rd, v),
        });
        break;
      }

      /* ---- sw: registrador -> memória (store word) ---- */
      case 'GUARDAR': {
        const v = this.reg(instr.rs);
        fases.push({
          focos: [`#reg-${instr.rs}`, `#mem-${instr.end}`],
          narra: `sw x${instr.rs}, MEM[${instr.end}]: escreve x${instr.rs} = ${v} em MEM[${instr.end}].`,
          faz: () => { this.memoria[instr.end] = v; },
        });
        break;
      }

      /* ---- out: registrador -> Saída (I/O) ---- */
      case 'MOSTRAR': {
        const v = this.reg(instr.rs);
        fases.push({
          focos: [`#reg-${instr.rs}`, '#outbox'],
          narra: `out x${instr.rs}: envia x${instr.rs} = ${v} para a Saída (I/O).`,
          faz: () => this.outbox.push(v),
        });
        break;
      }

      /* ---- addi: registrador + imediato (ULA) ---- */
      case 'SOMAR_NUM': {
        const a = this.reg(instr.rs);
        const r = a + instr.imm;
        fases.push({
          focos: [`#reg-${instr.rs}`, '#ula-box'],
          narra: `addi: a ULA recebe x${instr.rs} = ${a} e o imediato ${instr.imm}.`,
          ula: `${a} + ${instr.imm}`,
        });
        fases.push({
          focos: ['#ula-box', `#reg-${instr.rd}`],
          narra: `Escrita (write-back): resultado ${r} → x${instr.rd}.`,
          ula: `= ${r}`,
          faz: () => this.setReg(instr.rd, r),
        });
        break;
      }

      /* ---- add: registrador + registrador (ULA) ---- */
      case 'SOMAR': {
        const a = this.reg(instr.rs1), b = this.reg(instr.rs2);
        const r = a + b;
        fases.push({
          focos: [`#reg-${instr.rs1}`, `#reg-${instr.rs2}`, '#ula-box'],
          narra: `add: a ULA recebe x${instr.rs1} = ${a} e x${instr.rs2} = ${b}.`,
          ula: `${a} + ${b}`,
        });
        fases.push({
          focos: ['#ula-box', `#reg-${instr.rd}`],
          narra: `Escrita (write-back): resultado ${r} → x${instr.rd}.`,
          ula: `= ${r}`,
          faz: () => this.setReg(instr.rd, r),
        });
        break;
      }

      /* ---- sub: registrador - registrador (ULA) ---- */
      case 'SUBTRAIR': {
        const a = this.reg(instr.rs1), b = this.reg(instr.rs2);
        const r = a - b;
        fases.push({
          focos: [`#reg-${instr.rs1}`, `#reg-${instr.rs2}`, '#ula-box'],
          narra: `sub: a ULA recebe x${instr.rs1} = ${a} e x${instr.rs2} = ${b}.`,
          ula: `${a} - ${b}`,
        });
        fases.push({
          focos: ['#ula-box', `#reg-${instr.rd}`],
          narra: `Escrita (write-back): resultado ${r} → x${instr.rd}.`,
          ula: `= ${r}`,
          faz: () => this.setReg(instr.rd, r),
        });
        break;
      }

      /* ---- beq: desvio condicional (branch if equal) ---- */
      case 'PULAR_SE_IGUAL': {
        const a = this.reg(instr.rs1), b = this.reg(instr.rs2);
        const igual = a === b;
        const destino = this.rotulos[instr.rotulo];
        if (igual && destino !== undefined) saltouPara = destino;
        fases.push({
          focos: [`#reg-${instr.rs1}`, `#reg-${instr.rs2}`, '#ula-box'],
          narra: `beq: a ULA compara x${instr.rs1} = ${a} com x${instr.rs2} = ${b}. ` +
                 (igual
                   ? `Iguais → desvio tomado para "${instr.rotulo}".`
                   : `Diferentes → desvio não tomado; segue em sequência.`),
          ula: `${a} ${igual ? '==' : '!='} ${b}`,
        });
        break;
      }

      /* ---- label: rótulo, não gera instrução ---- */
      case 'MARCADOR': {
        fases.push({
          focos: [],
          narra: `Rótulo "${instr.nome}": não gera instrução; o PC apenas segue.`,
        });
        break;
      }

      default:
        fases.push({ focos: [], narra: `Instrução desconhecida (${instr.op}).` });
    }

    // Fase final: atualização do PC
    fases.push({
      focos: ['#pc-box'],
      narra: saltouPara !== null
        ? `PC ← ${saltouPara} (desvio tomado).`
        : `PC ← ${proxPc} (próxima instrução em sequência).`,
      faz: () => { this.pc = (saltouPara !== null) ? saltouPara : proxPc; },
    });

    return { fases, fim: false };
  }
}

// Disponibiliza globalmente (estamos sem módulos/bundler, tudo no navegador)
window.MachineState = MachineState;
window.NUM_REGISTRADORES = NUM_REGISTRADORES;
window.NUM_ARMARIOS = NUM_ARMARIOS;
