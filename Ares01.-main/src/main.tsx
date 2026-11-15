import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '@fontsource/space-mono/700.css';
import { createRoot } from 'react-dom/client';
import './ui/design/system.css';
import MarsGame from './game/MarsGame';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Tooltip.Provider delayDuration={250}><MarsGame /></Tooltip.Provider></React.StrictMode>);
