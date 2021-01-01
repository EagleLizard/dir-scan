export enum BYTE_ORDERS {
  GB = 'GB',
  MB = 'MB',
  KB = 'KB',
  B = 'B',
}

export const BYTE_DIVISORS = {
  [BYTE_ORDERS.GB]: 1024 * 1024 * 1024,
  [BYTE_ORDERS.MB]: 1024 * 1024,
  [BYTE_ORDERS.KB]: 1024,
  [BYTE_ORDERS.B]: 1,

};

export function getIntuitiveByteConversion(n: number): [ BYTE_ORDERS, number ] {
  if(n >= BYTE_DIVISORS.GB) {
    // return gb
    return [ BYTE_ORDERS.GB, n / BYTE_DIVISORS.GB ]
  }
  if(n >= BYTE_DIVISORS.MB) {
    // return mb
    return [ BYTE_ORDERS.MB, n / BYTE_DIVISORS.MB ]
  }
  if(n >= BYTE_DIVISORS.KB) {
    // return kb
    return [ BYTE_ORDERS.KB, n / BYTE_DIVISORS.KB ]
  }
  // return just bytes
  return [ BYTE_ORDERS.B, n / BYTE_DIVISORS.B ];
}
