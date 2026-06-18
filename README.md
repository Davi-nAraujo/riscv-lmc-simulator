# Simulador RISC-V • estilo Little Man Computer

Um simulador de assembly **RISC-V** que roda no navegador e usa a metáfora do
**Little Man Computer (LMC)** — a *"Cidade do Computador"* — para ensinar como uma
CPU funciona por dentro.

Você monta o programa **encaixando blocos** (estilo Scratch, via
[Blockly](https://developers.google.com/blockly)) e assiste a informação se mover
**passo a passo** pela cidade, com narração em português a cada fase.

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

## A metáfora da "Cidade do Computador"

| Personagem da cidade        | Conceito real             |
| --------------------------- | ------------------------- |
| **Armários**                | Memória de dados (24 células) |
| **Caixas de Mão**           | Registradores (`x0`–`x7`, `x0` sempre 0) |
| **Calculadora**             | ULA / ALU                 |
| **Contador (seta)**         | Program Counter (PC)      |
| **Caixa de Entrada/Saída**  | I/O (inbox / outbox)      |

---

## Conjunto de instruções

Cada bloco tem um nome amigável em português mapeado para um mnemônico RISC-V real:

| Bloco                | Assembly | O que faz                                   |
| -------------------- | -------- | ------------------------------------------- |
| Ler Entrada          | `in`     | Lê um número da Entrada para um registrador |
| Carregar da Memória  | `lw`     | Copia um armário para um registrador        |
| Guardar na Memória   | `sw`     | Copia um registrador para um armário        |
| Mostrar Saída        | `out`    | Envia um registrador para a Saída           |
| Somar Número         | `addi`   | Soma um número fixo a um registrador        |
| Somar                | `add`    | Soma dois registradores                     |
| Subtrair             | `sub`    | Subtrai dois registradores                  |
| Pular se Igual       | `beq`    | Desvia para um rótulo se dois reg. forem iguais |
| Rótulo               | *(label)*| Alvo de um `beq`                            |

O programa de exemplo lê dois números da Entrada (`[7, 5]`), soma-os e mostra o
resultado.

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
