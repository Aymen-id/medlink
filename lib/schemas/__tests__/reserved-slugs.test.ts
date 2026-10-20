import { expect,it } from 'vitest';
import { updateProfileSchema } from '../profile.schema';
it('reserves app routes while allowing a physician public URL',()=>{
  for(const slug of ['login','patients','settings','search','api','auth','reset-password','signup','analytics']) expect(updateProfileSchema.safeParse({ displayName:'Dr Example',slug }).success).toBe(false);
  expect(updateProfileSchema.safeParse({ displayName:'Dr Example',slug:'dr-example' }).success).toBe(true);
});
