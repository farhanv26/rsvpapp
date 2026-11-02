import { render,screen } from '@testing-library/react';
import { expect,it,vi } from 'vitest';
vi.mock('@/app/admin/login/actions',()=>({loginAdminAction:vi.fn()}));
import { AdminLoginForm } from '@/components/admin/admin-login-form';
it('offers a typed identifier and never an account directory',()=>{
 render(<AdminLoginForm errorMessage={null} />);
 expect(screen.getByRole('textbox',{name:'Account name'})).toHaveAttribute('autocomplete','username');
 expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
 expect(screen.queryByRole('option')).not.toBeInTheDocument();
 expect(screen.queryByText('Demo Aisha')).not.toBeInTheDocument();
});
