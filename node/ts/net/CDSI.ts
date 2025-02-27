//
// Copyright 2025 Signal Messenger, LLC.
// SPDX-License-Identifier: AGPL-3.0-only
//

import type { ReadonlyDeep } from 'type-fest';
import * as Native from '../../Native';
import { Aci } from '../Address';
import { Buffer } from 'node:buffer';
import { TokioAsyncContext, newNativeHandle, ServiceAuth } from '../net';

export type CDSRequestOptionsType = {
  e164s: Array<string>;
  acisAndAccessKeys: Array<{ aci: string; accessKey: string }>;
  /**
   * @deprecated this option is ignored by the server.
   */
  returnAcisWithoutUaks: boolean;
  abortSignal?: AbortSignal;
  useNewConnectLogic?: boolean;
};

export type CDSResponseEntryType<Aci, Pni> = {
  aci: Aci | undefined;
  pni: Pni | undefined;
};

export type CDSResponseEntries<Aci, Pni> = Map<
  string,
  CDSResponseEntryType<Aci, Pni>
>;

export interface CDSResponseType<Aci, Pni> {
  entries: CDSResponseEntries<Aci, Pni>;
  debugPermitsUsed: number;
}

export async function cdsiLookup(
  {
    asyncContext,
    connectionManager,
  }: Readonly<{
    asyncContext: TokioAsyncContext;
    connectionManager: Native.Wrapper<Native.ConnectionManager>;
  }>,
  { username, password }: Readonly<ServiceAuth>,
  {
    e164s,
    acisAndAccessKeys,
    abortSignal,
    useNewConnectLogic,
  }: ReadonlyDeep<CDSRequestOptionsType>
): Promise<CDSResponseType<string, string>> {
  const request = newNativeHandle(Native.LookupRequest_new());
  e164s.forEach((e164) => {
    Native.LookupRequest_addE164(request, e164);
  });

  acisAndAccessKeys.forEach(({ aci: aciStr, accessKey: accessKeyStr }) => {
    Native.LookupRequest_addAciAndAccessKey(
      request,
      Aci.parseFromServiceIdString(aciStr).getServiceIdFixedWidthBinary(),
      Buffer.from(accessKeyStr, 'base64')
    );
  });

  const startLookup = useNewConnectLogic
    ? Native.CdsiLookup_new_routes
    : Native.CdsiLookup_new;

  const lookup = await asyncContext.makeCancellable(
    abortSignal,
    startLookup(asyncContext, connectionManager, username, password, request)
  );
  return await asyncContext.makeCancellable(
    abortSignal,
    Native.CdsiLookup_complete(asyncContext, newNativeHandle(lookup))
  );
}
