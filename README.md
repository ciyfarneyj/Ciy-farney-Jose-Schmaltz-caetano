# FinanceControl

Aplicativo mobile para controle de recebimentos e contas pessoais e do escritório.

## Funcionalidades

- **Autenticação** com Firebase (login/cadastro)
- **Dashboard** com saldo, gráficos e lançamentos recentes
- **Receitas e Despesas** com separação Pessoal / Escritório
- **Status de pagamento** para contas (pago / pendente)
- **Relatórios** mensais com gráficos de linha e barras
- **Alertas Inteligentes**:
  - Detecção de lançamentos duplicados
  - Alertas de gastos excessivos (>20% acima do mês anterior)
  - Plano de economia personalizado
  - Dicas de economia por categoria

## Configuração do Firebase

1. Acesse [https://console.firebase.google.com](https://console.firebase.google.com)
2. Crie um novo projeto (ou use um existente)
3. Adicione um app **Web** ao projeto
4. Ative **Authentication → Email/Senha**
5. Ative **Firestore Database** (modo de produção ou teste)
6. Copie as credenciais do app e substitua em `src/config/firebase.ts`:

```ts
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

### Índices Firestore necessários

No console do Firebase, crie os seguintes índices compostos em **Firestore → Índices**:

| Coleção | Campo 1 | Campo 2 | Campo 3 | Ordem |
|---------|---------|---------|---------|-------|
| transactions | userId (ASC) | date (DESC) | — | — |
| transactions | userId (ASC) | date (ASC) | date (ASC) | — |

## Como executar

```bash
# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npx expo start

# Rodar no Android
npx expo start --android

# Rodar no iOS
npx expo start --ios
```

Abra o app [Expo Go](https://expo.dev/go) no celular e escaneie o QR code.

## Estrutura do projeto

```
src/
├── config/          # Configuração Firebase
├── context/         # Context API (autenticação)
├── navigation/      # React Navigation
├── screens/
│   ├── auth/        # Login e Cadastro
│   ├── DashboardScreen.tsx
│   ├── TransactionsScreen.tsx
│   ├── AddTransactionScreen.tsx
│   ├── ReportsScreen.tsx
│   └── AlertsScreen.tsx
├── components/      # Componentes reutilizáveis
├── services/        # Firebase + motor de alertas
├── theme/           # Cores e categorias
└── types/           # TypeScript types
```

## Tecnologias

- React Native + Expo
- Firebase (Auth + Firestore)
- React Navigation
- React Native Paper (UI)
- react-native-chart-kit (gráficos)
- date-fns (manipulação de datas)
