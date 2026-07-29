import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom doesn't implement scrollIntoView — PaymentStep.tsx calls it in a
// mount effect, which would otherwise throw before render() ever returns.
Element.prototype.scrollIntoView = vi.fn();
