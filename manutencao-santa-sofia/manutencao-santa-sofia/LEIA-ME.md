# Manutenção - Faz. Santa Sofia

Sistema de controle de revisões de máquinas e implementos da Agropecuária Santa Sofia.

- **Quem tem o link:** só visualiza (painel, máquinas, implementos, gastos).
- **Quem tem a senha:** cadastra, lança revisões, edita e exclui.
- **Dados:** ficam numa Google Planilha, a mesma ideia do painel de fertilizantes.
- **A senha** fica guardada no Google Apps Script, não no GitHub. Mesmo quem olhar o código do site não consegue alterar nada sem ela.

## Arquivos

```
index.html              página principal
css/style.css           visual
js/config.js            ⚙️  onde você cola a URL do Apps Script
js/app.js               funcionamento do sistema
img/                    logo da fazenda
apps-script/Code.gs     código para colar no Google Apps Script
.nojekyll               necessário para o GitHub Pages
```

---

## Passo 1 — Criar a planilha e o Apps Script

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha nova. Dê o nome **Manutenção Santa Sofia - Dados**.
2. No menu da planilha, clique em **Extensões > Apps Script**.
3. Apague o código que aparece e cole todo o conteúdo do arquivo `apps-script/Code.gs`. Clique em **Salvar** (ícone de disquete).
4. **Defina a senha:** no Apps Script, clique no ícone de engrenagem (**Configurações do projeto**). Role até **Propriedades do script**, clique em **Adicionar propriedade do script** e preencha:
   - Propriedade: `SENHA`
   - Valor: a senha que você quer usar (exemplo: `2217`)
   - Clique em **Salvar propriedades do script**.
5. **Publique:** clique em **Implantar > Nova implantação**.
   - Em "Selecione o tipo", escolha **App da Web**.
   - Executar como: **Eu**.
   - Quem pode acessar: **Qualquer pessoa**.
   - Clique em **Implantar** e autorize com sua conta Google. Se aparecer "o Google não verificou este app", clique em **Avançado > Acessar**.
6. Copie a **URL do app da Web**. Ela termina em `/exec`.

## Passo 2 — Colar a URL no sistema

Abra o arquivo `js/config.js` e cole a URL entre as aspas de `API_URL`:

```js
API_URL: 'https://script.google.com/macros/s/AKfy..../exec',
```

## Passo 3 — Publicar no GitHub

1. Entre em [github.com](https://github.com) e clique em **New repository**.
   - Nome: `manutencao-santa-sofia`
   - Marque **Public**. O GitHub Pages gratuito precisa de repositório público. Os dados não ficam no repositório, só na planilha.
   - Clique em **Create repository**.
2. Na página do repositório, clique em **uploading an existing file**. Arraste **todo o conteúdo** desta pasta: `index.html`, as pastas `css`, `js`, `img`, `apps-script` e o arquivo `.nojekyll`. Clique em **Commit changes**.
   - Dica: o arquivo `.nojekyll` começa com ponto e pode ficar oculto no computador. Se ele não subir, o site funciona do mesmo jeito.
3. Vá em **Settings > Pages**.
   - Em **Source**, escolha **Deploy from a branch**.
   - Branch: **main**, pasta **/ (root)**. Clique em **Save**.
4. Aguarde 1 a 2 minutos. O link aparece no topo da página de Pages:

```
https://SEU-USUARIO.github.io/manutencao-santa-sofia/
```

Esse é o link para mandar para quem só vai visualizar.

## Como usar

- Clique em **Somente visualização · Editar**, no canto do cabeçalho, e digite a senha. O sistema entra em **Modo de edição** e aparecem os botões de cadastrar, lançar, editar e excluir.
- Para sair, clique em **Modo de edição · Sair**. Ao fechar a aba, o modo de edição também é desligado.
- Os dados atualizam sozinhos a cada 20 segundos para quem está com a página aberta.
- **Exportar backup**, no rodapé, baixa um arquivo `.json` com tudo. **Importar backup** (só no modo de edição) restaura esse arquivo.

## Trocar a senha

No Apps Script: **Configurações do projeto > Propriedades do script**. Altere o valor de `SENHA` e salve. Vale na hora, sem precisar publicar de novo.

## Alterar o código do Apps Script depois

Se mudar o `Code.gs`, publique de novo em **Implantar > Gerenciar implantações > ✏️ Editar > Versão: Nova versão > Implantar**. Assim a URL continua a mesma.

## Modo de teste

Enquanto `API_URL` estiver vazio, o sistema salva só no navegador de quem estiver usando. A senha de teste é a de `SENHA_TESTE`, em `js/config.js`. Serve para experimentar antes de ligar a planilha.
