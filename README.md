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

---

## Desafios

A coluna do editor traz um seletor de **desafios** propostos. A ideia é
**tentar resolver primeiro**: escolha um desafio, leia o enunciado (e o resultado
esperado), monte seu programa e execute. Cada desafio já configura seu próprio
cenário (valores na Entrada e na memória).

- **Tentar do zero** — limpa o editor para você montar a sua solução.
- **Ver solução** — se travar, revela uma solução pronta no editor.

| # | Desafio                          | Conceito                                  |
| - | -------------------------------- | ----------------------------------------- |
| 1 | Soma de dois números             | `in`, `add`, `out`                        |
| 2 | Dobro de um número               | somar um registrador com ele mesmo        |
| 3 | Diferença (a − b)                | `sub` e ordem dos operandos               |
| 4 | Memória: ler, alterar, guardar   | `lw` / `sw` (ciclo load–modify–store)     |
| 5 | Laço com `beq`: contagem regressiva | rótulos, desvio condicional e salto incondicional (`beq x0, x0, loop`) |

---

## Arquitetura

O código é separado por responsabilidade. A ideia central: **a lógica não desenha
nada**. Cada instrução, ao executar, devolve uma lista de *fases* de animação, e a
camada de UI as reproduz com calma.

| Arquivo        | Papel                                                                 |
| -------------- | --------------------------------------------------------------------- |
| `machine.js`   | O motor lógico. `MachineState` guarda todo o estado e `executarPasso()` executa uma instrução, devolvendo as fases da animação (sem mexer no DOM). |
| `blocks.js`    | Define os blocos do Blockly e o "montador": `montarPrograma()` lê os blocos encaixados e gera a lista de instruções (IR). |
| `examples.js`  | Os desafios propostos, seus cenários e soluções; `programaXml()` converte uma solução em blocos do Blockly. |
| `app.js`       | A camada que liga tudo: inicia o editor, desenha o painel de estado, anima fase a fase, controla os desafios e liga os botões. |
| `index.html`   | Layout em 3 colunas (guia / editor / estado do processador) + toolbox do Blockly. |
| `styles.css`   | Tema escuro (estilo debugger).                                        |

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

- **Passo** — executa uma instrução (com todas as suas fases animadas).
- **Executar tudo** — executa até o fim.
- **Reiniciar** — recarrega o cenário e zera o estado, mantendo os blocos.
- **Velocidade** — ajusta o tempo de cada fase.

---

## Limitações conhecidas

- O cenário (Entrada e memória) é definido por desafio, não editável pela UI.
- Apenas a primeira pilha de blocos é executada (pilhas soltas são ignoradas).
- Aritmética de 32 bits truncada (`| 0`); sem overflow/flags.
