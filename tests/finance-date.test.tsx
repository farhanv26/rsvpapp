import { cleanup,render,screen } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { PaymentFields } from '@/components/admin/finance/fields';
import { paymentToday } from '@/lib/finance-date';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('uses the wedding calendar date across UTC midnight and daylight saving changes',()=>{
 expect(paymentToday('America/Toronto',new Date('2026-11-03T03:30:00Z'))).toBe('2026-11-02');
 expect(paymentToday('Asia/Tokyo',new Date('2026-11-02T23:30:00Z'))).toBe('2026-11-03');
 expect(paymentToday('America/Toronto',new Date('2026-03-08T06:30:00Z'))).toBe('2026-03-08');
});
it('defaults and bounds the payment form to the same local day as server validation',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-03T03:30:00Z'));
 render(<PaymentFields currency="CAD" timezone="America/Toronto"/>);
 const date=screen.getByLabelText('Date paid');expect(date).toHaveValue('2026-11-02');expect(date).toHaveAttribute('max','2026-11-02');
});
