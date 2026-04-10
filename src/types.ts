/**
 * Core type definitions for domain-whois-mcp
 */

/** Parsed WHOIS lookup result */
export interface WhoisResult {
  domainName: string;
  registrar?: string;
  registrarUrl?: string;
  registrarWhoisServer?: string;
  registryDomainId?: string;
  creationDate?: string;
  expirationDate?: string;
  updatedDate?: string;
  status: string[];
  nameservers: string[];
  dnssec?: string;
  registrant?: ContactInfo;
  admin?: ContactInfo;
  tech?: ContactInfo;
  rawText: string;
  whoisServer: string;
  queriedAt: string;
}

/** Contact information from WHOIS record */
export interface ContactInfo {
  name?: string;
  organization?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

/** RDAP lookup result */
export interface RdapResult {
  ldhName: string;
  unicodeName?: string;
  handle?: string;
  status: string[];
  events: RdapEvent[];
  nameservers: string[];
  entities: RdapEntity[];
  secureDNS?: {
    delegationSigned: boolean;
    dsData?: Array<{
      keyTag: number;
      algorithm: number;
      digestType: number;
      digest: string;
    }>;
  };
  links: RdapLink[];
  port43?: string;
  rdapServer: string;
  queriedAt: string;
  raw: unknown;
}

/** RDAP event entry */
export interface RdapEvent {
  eventAction: string;
  eventDate: string;
  eventActor?: string;
}

/** RDAP entity (registrar, registrant, etc.) */
export interface RdapEntity {
  handle?: string;
  roles: string[];
  publicIds?: Array<{ type: string; identifier: string }>;
  vcardArray?: unknown[];
  entities?: RdapEntity[];
}

/** RDAP link */
export interface RdapLink {
  value?: string;
  rel?: string;
  href: string;
  type?: string;
}

/** Domain availability check result */
export interface DomainCheckResult {
  domain: string;
  available: boolean | null;
  method: 'whois' | 'rdap' | 'both' | 'error';
  whois?: WhoisResult;
  rdap?: RdapResult;
  error?: string;
  checkedAt: string;
}

/** Bulk domain check result */
export interface BulkCheckResult {
  results: DomainCheckResult[];
  totalChecked: number;
  available: number;
  registered: number;
  unknown: number;
  errors: number;
  durationMs: number;
}

/** TLD information from IANA */
export interface TldInfo {
  tld: string;
  type: string;
  whoisServer: string | null;
  rdapServers: string[];
  ianaRawResponse: string;
}

/** WHOIS query options */
export interface WhoisQueryOptions {
  server?: string;
  port?: number;
  timeout?: number;
  follow?: boolean;
  encoding?: BufferEncoding;
}

/** RDAP query options */
export interface RdapQueryOptions {
  server?: string;
  timeout?: number;
}
