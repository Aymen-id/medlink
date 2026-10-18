import { expect,it } from 'vitest';
import { render,screen } from '@testing-library/react';
import Home from '../page';
it('explains the physician workspace and links real sign-up and login flows',()=>{
  render(<Home />);
  expect(screen.getByRole('heading',{ level:1 })).toHaveTextContent('Your practice, in one place.');
  expect(screen.getByRole('link',{ name:'Start for free' })).toHaveAttribute('href','/signup');
  expect(screen.getByRole('link',{ name:'Log in' })).toHaveAttribute('href','/login');
  expect(screen.getByText('$29')).toBeVisible();expect(screen.getByText('$99')).toBeVisible();
  expect(screen.queryByText(/Get started by editing/)).toBeNull();
});
