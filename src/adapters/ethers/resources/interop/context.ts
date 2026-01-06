// src/adapters/ethers/resources/interop/context.ts
import { Interface } from 'ethers';
import type { InteropAddresses, InteropBaseTokens, InteropEthersContext } from './types';
import type { Hex } from '../../../../core/types/primitives';
import type { InteropTopics } from '../../../../core/resources/interop/events';
import type { EthersClient } from '../../client';
import IERC7786AttributesAbi from '../../../../core/internal/abis/IERC7786Attributes';
import InteropCenterAbi from '../../../../core/internal/abis/InteropCenter';
import IInteropHandlerAbi from '../../../../core/internal/abis/IInteropHandler';

function buildTopics(): InteropTopics {
  const center = new Interface(InteropCenterAbi);
  const handler = new Interface(IInteropHandlerAbi);
  const topic = (iface: Interface, name: string) => iface.getEvent(name)!.topicHash as Hex;
  return {
    InteropBundleSent: topic(center, 'InteropBundleSent'),
    BundleVerified: topic(handler, 'BundleVerified'),
    BundleExecuted: topic(handler, 'BundleExecuted'),
    BundleUnbundled: topic(handler, 'BundleUnbundled'),
  };
}

// Create an InteropEthersContext for src/dst chain pair.
export async function makeInteropContext(
  client: EthersClient,
  dstChain: bigint,
): Promise<InteropEthersContext> {
  const srcProvider = client.l2;
  // Use chain registry for destination provider, fallback to L2 if not registered
  const dstProvider = client.getProvider(dstChain) ?? client.l2;
  const signer = client.signerFor();

  const [srcNet, dstNet] = await Promise.all([srcProvider.getNetwork(), dstProvider.getNetwork()]);
  const srcChainId = BigInt(srcNet.chainId.toString());
  const dstChainId = BigInt(dstNet.chainId.toString());

  const addresses = await client.ensureAddresses();
  const { interopCenter, interopHandler, bridgehub, l2AssetRouter } = addresses;
  if (!interopCenter || !interopHandler) {
    throw new Error('Interop addresses not resolved');
  }
  const interopAddresses: InteropAddresses = { interopCenter, interopHandler, bridgehub, l2AssetRouter };

  const baseTokens: InteropBaseTokens = {
    src: await client.baseToken(srcChainId),
    dst: await client.baseToken(dstChainId),
  };

  const ifaces = {
    attributes: new Interface(IERC7786AttributesAbi),
    interopCenter: new Interface(InteropCenterAbi),
    interopHandler: new Interface(IInteropHandlerAbi),
  };
  const topics = buildTopics();

  return {
    srcProvider,
    dstProvider,
    signer,
    srcChainId,
    dstChainId,
    addresses,
    baseTokens,
    ifaces,
    topics,
  };
}
