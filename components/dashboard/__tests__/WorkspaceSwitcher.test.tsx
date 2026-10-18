import {expect,it,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
import {WorkspaceSwitcher} from '../WorkspaceSwitcher';
it('displays the selected physician name instead of the internal workspace identifier before opening the picker',()=>{
  render(<WorkspaceSwitcher selectedId="00000000-0000-4000-8000-000000000001" workspaces={[{id:'00000000-0000-4000-8000-000000000001',name:'Dr Synthetic Clinic'}]}/>);
  expect(screen.getByRole('combobox',{name:'Workspace'})).toHaveTextContent('Dr Synthetic Clinic');
  expect(screen.getByRole('combobox',{name:'Workspace'})).not.toHaveTextContent('00000000');
});
