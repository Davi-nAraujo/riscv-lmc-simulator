# Simulador RISC-V

Um simulador de assembly **RISC-V** que roda no navegador. Você monta o programa
**encaixando instruções** (editor de blocos via
[Blockly](https://developers.google.com/blockly)) e executa o
**ciclo busca–decodificação–execução** passo a passo, acompanhando o estado do
**PC**, dos **registradores**, da **ULA**, da **memória** e da **I/O** a cada
instrução, com narração técnica em português.

Projeto da disciplina de **Organização de Computadores** (3º período).

---

## Como rodar

Não há build nem dependências locais — tudo é carregado via CDN. Basta servir os
arquivos estáticos:

```bash
# opção 1: Python
python3 -m http.server 8000

# opção 2: Node
npx serve .
```

Depois abra <http://localhost:8000>.

> Abrir o `index.html` direto com `file://` também funciona, mas servir via HTTP
> evita problemas de cache/CORS com o Blockly.

---

## Componentes do processador

| Componente            | Descrição                                                  |
| --------------------- | ---------------------------------------------------------- |
| **PC**                | *Program Counter*: aponta para a próxima instrução.        |
| **Registradores**     | `x0`–`x7`, armazenamento rápido. `x0` é fixo em 0 (RISC-V).|
| **ULA**               | Unidade Lógica e Aritmética: soma, subtrai e compara.      |
| **Memória**           | `MEM[0]`–`MEM[23]`, dados endereçados.                     |
| **Entrada / Saída**   | Fluxos de I/O (*inbox* e *outbox*).                        |

---

## Conjunto de instruções

| Sintaxe                  | O que faz                                                       |
| ------------------------ | -------------------------------------------------------------- |
| `in   rd`                | Lê o próximo valor da Entrada (I/O) no registrador `rd`.        |
| `lw   rd, MEM[end]`      | *Load word*: carrega `MEM[end]` em `rd`.                        |
| `sw   rs, MEM[end]`      | *Store word*: escreve `rs` em `MEM[end]`.                       |
| `out  rs`                | Envia o valor de `rs` para a Saída (I/O).                       |
| `addi rd, rs, imm`       | `rd = rs + imm` (soma com imediato, via ULA).                  |
| `add  rd, rs1, rs2`      | `rd = rs1 + rs2` (via ULA).                                     |
| `sub  rd, rs1, rs2`      | `rd = rs1 - rs2` (via ULA).                                     |
| `beq  rs1, rs2, label`   | *Branch if equal*: se `rs1 == rs2`, o PC desvia para `label`.  |
| `label:`                 | Rótulo, alvo de `beq`. Não gera instrução.                     |

O programa de exemplo lê dois valores da Entrada (`[7, 5]`), soma-os e envia o
resultado para a Saída.

---

## Arquitetura

O código é separado por responsabilidade. A ideia central: **a lógica não desenha
nada**. Cada instrução, ao executar, devolve uma lista de *fases* de animação, e a
camada de UI as reproduz com calma.

| Arquivo        | Papel                                                                 |
| -------------- | --------------------------------------------------------------------- |
| `machine.js`   | O "cérebro". `MachineState` guarda todo o estado e `executarPasso()` executa uma instrução, devolvendo as fases da animação (sem mexer no DOM). |
| `blocks.js`    | Define os blocos do Blockly e o "montador": `montarPrograma()` lê os blocos encaixados e gera a lista de instruções (IR). |
| `app.js`       | A cola: inicia o Blockly, desenha a cidade, anima fase a fase e liga os botões. |
| `index.html`   | Layout em 3 colunas (guia / blocos / cidade) + toolbox do Blockly.    |
| `styles.css`   | Estilos.                                                              |

### Fluxo

```
blocos (Blockly)
   │  montarPrograma()
   ▼
IR (lista de instruções)
   │  carregarPrograma()  → resolve rótulos
   ▼
MachineState.executarPasso()  → devolve { fases }
   │
   ▼
app.js animarFase()  → acende focos, narra, e só então aplica faz()
```

Cada fase tem o formato `{ focos: [...seletores], narra: "texto", faz: () => {...} }`.
O valor só muda **depois** da explicação (`faz()` é chamado ao fim da fase), para o
aluno ver a causa antes do efeito.

---

## Controles

- **Passo a Passo** — executa uma instrução (com todas as suas fases animadas).
- **Rodar Tudo** — executa até o fim.
- **Reiniciar** — limpa o estado, mantém os blocos.
- **Velocidade** — ajusta o tempo de cada fase.

---

## Limitações conhecidas

- O cenário inicial é fixo: Entrada `[7, 5]` e `memória[10]=42`, `memória[11]=8`.
- Apenas a primeira pilha de blocos é executada (pilhas soltas são ignoradas).
- Aritmética de 32 bits truncada (`| 0`); sem overflow/flags.
