import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import { wagmiConfig } from './wagmi';
import { SwapPage } from './pages/Swap';
import { PoolPage } from './pages/Pool';
import { PositionPage } from './pages/Position';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000, // 10s 内不重复请求
      refetchOnWindowFocus: false, // 切回标签页不自动刷
      retry: 2,
    },
  },
});

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <BrowserRouter>
            <Header />
            <Routes>
              <Route path="/" element={<Navigate to="/swap" replace />} />
              <Route path="/swap" element={<SwapPage />} />
              <Route path="/pool" element={<PoolPage />} />
              <Route path="/position" element={<PositionPage />} />
            </Routes>
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
