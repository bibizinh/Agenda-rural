# Agenda Rural

PWA em português para organizar a rotina de pequenos e médios produtores rurais. Registre atividades, acompanhe insumos e mantenha o histórico das safras, inclusive sem conexão.

## Recursos

- **Atividades:** cadastro de tarefas com data, tipo, talhão e observações; busca, filtros e conclusão.
- **Estoque:** insumos com quantidade, unidade, localização e aviso visual de estoque baixo.
- **Safras:** cultura, variedade, área, data de plantio, previsão de colheita e situação.
- **Offline:** interface armazenada pelo Service Worker e dados locais persistidos no IndexedDB do navegador.
- **Instalável:** manifesto PWA e botão de instalação quando oferecido pelo navegador Android.

## Executar localmente

O Service Worker exige HTTPS, exceto em `localhost`. Na pasta do projeto, inicie um servidor estático, por exemplo:

```bash
python -m http.server 8000
```

Acesse `http://localhost:8000`. Abrir `index.html` diretamente como arquivo não habilita o Service Worker.

## Publicar e instalar no Android

Publique os arquivos em uma origem HTTPS (GitHub Pages é uma opção). No Android, abra o endereço no Chrome e use **Instalar app** quando o botão aparecer, ou o menu do navegador e **Instalar app / Adicionar à tela inicial**. Abra o app online uma vez para que o Service Worker guarde os arquivos necessários; depois, a interface e os registros locais ficam disponíveis offline.

## Dados e limitações desta versão

Os dados são salvos no IndexedDB do navegador e ficam neste aparelho e neste perfil de navegador. Não há conta, backup remoto nem sincronização entre aparelhos. Limpar os dados do navegador pode apagar os registros; exporte-os ou faça backup antes de limpar o armazenamento. Para distribuir na Play Store, será necessário empacotar o PWA (por exemplo, com Trusted Web Activity) e atender aos requisitos de publicação do Google Play.
