import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CollapsibleSection } from '@/components/admin/collapsible-section';
afterEach(()=>vi.restoreAllMocks());
it('remains operable with disabled storage and removes collapsed content from keyboard interaction',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('storage blocked');});
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('storage blocked');});
 render(<CollapsibleSection id="test-section" title="Schedule" storageKey="disabled-storage"><a href="#test">Edit schedule</a></CollapsibleSection>);
 const button=screen.getByRole('button',{name:'Schedule'});
 expect(button).toHaveAttribute('aria-expanded','true');
 fireEvent.click(button);
 expect(button).toHaveAttribute('aria-expanded','false');
 expect(screen.getByText('Edit schedule').parentElement).toHaveAttribute('inert');
 fireEvent.click(button);
 expect(button).toHaveAttribute('aria-expanded','true');
});
