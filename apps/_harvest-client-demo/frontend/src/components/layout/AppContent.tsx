import { Content } from '@carbon/react';
import type { ReactNode } from 'react';
import './AppContent.scss';

interface AppContentProps {
  children: ReactNode;
}

export const AppContent = ({ children }: AppContentProps) => {
  return (
    <Content className="app-content">
      {children}
    </Content>
  );
};

// Made with Bob
