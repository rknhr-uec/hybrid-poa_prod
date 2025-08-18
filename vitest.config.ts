import { defineConfig } from 'vitest/config';

const TIMEOUT = 0;

export default defineConfig({
	test: {
		fileParallelism: false,
		projects: [
			{
				test: {
					name: 'ENV_CHECK',
					include: ['test/env_check.test.ts'],
					sequence: {
						groupOrder: 0,
					},
					testTimeout: TIMEOUT,
				},
			},
			{
				test: {
					name: 'ACCOUNT_TREE_LEAF',
					include: ['test/account_tree_leaf.test.ts'],
					sequence: {
						groupOrder: 1,
					},
					testTimeout: TIMEOUT,
				},
			},
			{
				test: {
					name: 'ACCOUNT_TREE_INTERNAL',
					include: ['test/account_tree_internal.test.ts'],
					sequence: {
						groupOrder: 2,
					},
					testTimeout: TIMEOUT,
				},
			},
			{
				test: {
					name: 'ACCOUNT_TREE_ROOT',
					include: ['test/account_tree_root.test.ts'],
					sequence: {
						groupOrder: 3,
					},
					testTimeout: TIMEOUT,
				},
			},
			{
				test: {
					name: 'CUSTODIAN_TREE_LEAF',
					include: ['test/custodian_tree_leaf.test.ts'],
					sequence: {
						groupOrder: 4,
					},
					testTimeout: TIMEOUT,
				},
			},
			{
				test: {
					name: 'CUSTODIAN_TREE_ROOT',
					include: ['test/custodian_tree_root.test.ts'],
					sequence: {
						groupOrder: 5,
					},
					testTimeout: TIMEOUT,
				},
			},
		],
	},
});
