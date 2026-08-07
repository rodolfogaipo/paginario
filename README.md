# Paginário

App de clube de leitura: cada pessoa se cadastra, registra a leitura diária (check-in de páginas), tem sequência (🔥), meta mensal automática, desafios privados com amigos por @usuário, e um ranking geral por total de páginas lidas.

Você **não precisa escrever nenhum código**. Só precisa fazer uma configuração única (Firebase) e depois publicar os arquivos (GitHub). São dois sites, ambos gratuitos. Vou te guiar em cada clique.

---

## Antes de começar

Você vai precisar de:
- Uma conta Google (pra criar o Firebase)
- Uma conta no GitHub (grátis, criar em github.com se ainda não tiver)

Leva uns 15 minutos na primeira vez. Depois disso, o app fica no ar sozinho.

---

## PARTE 1 — Criar o "banco de dados" no Firebase

O Firebase é quem guarda os cadastros, os livros, as leituras e os desafios. Vamos usar a parte chamada **Realtime Database**, que é gratuita e **não pede cartão de crédito** (diferente do Firestore, que o Google passou a exigir cartão pra criar, mesmo de graça).

1. Acesse **https://console.firebase.google.com** e entre com sua conta Google.
2. Clique em **"Criar um projeto"**. Dê o nome que quiser (ex: `paginario`). Pode desativar o Google Analytics — não precisa dele.
3. Quando o projeto abrir, no menu à esquerda clique em **Segurança → Authentication**.
   - Clique em **"Vamos começar"**.
   - Na lista, clique em **"E-mail/senha"**, ative a primeira chavinha, e clique em **Salvar**.
4. Ainda no menu à esquerda, clique em **"Bancos de dados e armazenamento"** e escolha **"Realtime Database"** (não é o Firestore, não é o Storage).
   - Clique em **"Criar banco de dados"**.
   - Escolha uma localização perto do Brasil, se ele perguntar.
   - Selecione **"Iniciar em modo bloqueado"** (locked mode) ou **"modo de produção"** — qualquer um dos dois nomes que aparecer, pois vamos colar nossas próprias regras no passo seguinte.
5. Depois de criado, copie o endereço que aparece no topo da tela, algo como `https://paginario-52f48-default-rtdb.firebaseio.com`. Você vai precisar dele daqui a pouco.
6. Clique na aba **"Regras"** (Rules) lá em cima. Apague tudo que estiver escrito lá e cole isto no lugar:

```json
{
  "rules": {
    "usuarios": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "usernames": {
      "$username": {
        ".read": "auth != null",
        ".write": "auth != null && (!data.exists() || data.val() == auth.uid)"
      }
    },
    "livros": {
      ".indexOn": ["uid"],
      "$livroId": {
        ".read": "auth != null",
        ".write": "auth != null && (!data.exists() || data.child('uid').val() == auth.uid) && newData.child('uid').val() == auth.uid"
      }
    },
    "atividades": {
      ".indexOn": ["criadoEm"],
      "$id": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "historicoMeses": {
      "$id": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "desafios": {
      "$id": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "desafiosPorUsuario": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

   Clique em **"Publicar"**.

> Nota: essas regras são simplificadas pra funcionar bem num app entre amigos/família. Elas exigem estar logado pra ler ou escrever, mas não travam tudo no nível de detalhe de um banco corporativo — perfeitamente adequado pro tamanho do Paginário.

---

## PARTE 2 — Conferir as chaves do projeto

Boa notícia: o arquivo **`firebase-config.js`** já vem preenchido com as chaves do seu projeto Firebase (`paginario-52f48`). Você não precisa editar nada aqui — só confira, se quiser, que o arquivo está do jeito que veio, sem alterações.

Se um dia você criar um projeto Firebase novo (por exemplo, pra outra pessoa usar o Paginário com um banco separado), aí sim precisaria repetir os passos da Parte 1 e colar as novas chaves nesse arquivo.

---

## PARTE 3 — Publicar no GitHub Pages

1. Crie um repositório novo no **github.com** (pode ser público), por exemplo `paginario`.
2. Dentro do repositório, clique em **"Add file" → "Upload files"**, arraste **todos os arquivos desta pasta** (inclusive `logo-paginario.png`) e clique em **Commit changes**.
3. Vá em **Settings → Pages** (no menu do repositório).
4. Em "Branch", escolha **`main`** e a pasta **`/ (root)`**, clique em **Save**.
5. Espere 1-2 minutos. Vai aparecer um link tipo `https://seu-usuario.github.io/paginario/`.

---

## PARTE 4 — Autorizar o site no Firebase (não pule esse passo!)

O login só funciona em endereços autorizados:

1. Volte ao Firebase Console → **Authentication → Settings → Authorized domains**.
2. Clique em **"Add domain"** e digite: `seu-usuario.github.io` (sem `https://`, sem barra no final).
3. Salve.

Pronto! Acesse o link do GitHub Pages no celular ou computador, crie sua conta e comece a registrar suas leituras.

---

## Como o app funciona por dentro (resumo)

- **index.html** — login e cadastro (nome, @usuário, senha, foto opcional, ritmo de leitura mensal)
- **inicio.html** — painel: saudação, sequência 🔥, meta do mês, livro atual, atividade do clube
- **estante.html** — seu perfil e os livros que você já concluiu. Toque na foto ou no lápis ✎ ao lado do nome pra alterar quando quiser.
- **registrar.html** — check-in diário de páginas, começar livro novo, finalizar livro
- **clube.html** — seus desafios e criar um novo, convidando por @usuário
- **desafio.html** — ranking de um desafio específico
- **ranking.html** — ranking geral do Paginário
- **perfil.html** — estante pública de qualquer leitor

A sequência (🔥), a meta do mês e o ranking são todos calculados automaticamente a partir dos check-ins diários — você não precisa mexer em nada manualmente, exceto se quiser ajustar sua meta pelo lápis ✎ na tela Início.

## Se algo der errado

- **Tela branca ou erro de login:** confira se colou certo as chaves no `firebase-config.js` (Parte 2), especialmente o `databaseURL`, e se autorizou o domínio (Parte 4).
- **Erro "permission-denied" ao salvar algo:** normalmente é a regra do Realtime Database (Parte 1, passo 6) que não foi publicada certinho — vale conferir e publicar de novo.
- **Aviso sobre "index not defined" no console do navegador:** normalmente já está coberto pelas regras que você colou (`.indexOn`), mas se aparecer, é só seguir a instrução que o próprio aviso mostra.

Qualquer coisa, me manda o erro que aparece (pode ser print de tela) que eu te ajudo a resolver.
