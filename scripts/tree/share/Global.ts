import { AztecAddress, AztecNode } from '@aztec/aztec.js';
import { BlockHeader } from '@aztec/stdlib/tx';

export interface Global {
	aztecNode: AztecNode;
	blockNumber: number;
	blockHeader: BlockHeader;
	tokenAddr: AztecAddress;
}
