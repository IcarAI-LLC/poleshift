import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactCompiler from 'eslint-plugin-react-compiler'

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            'react-compiler': reactCompiler,
        },
        rules: {
            'react-compiler/react-compiler': 'error',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
]