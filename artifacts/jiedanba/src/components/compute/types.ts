export interface Notebook {
  id: number;
  name: string;
  status: string;
  envType?: string | null;
  image?: string | null;
  resourceSpec?: string | null;
  sshEnabled?: boolean | null;
  description?: string | null;
  startedAt?: string | null;
  stoppedAt?: string | null;
  totalRuntimeSeconds?: number | null;
  createdAt?: string | null;
}

export interface TrainingJob {
  id: number;
  name: string;
  status: string;
  mode?: string | null;
  image?: string | null;
  resourceSpec?: string | null;
  command?: string | null;
  datasetPath?: string | null;
  outputPath?: string | null;
  description?: string | null;
  createdAt?: string | null;
}

export interface InferenceService {
  id: number;
  name: string;
  serviceType?: string | null;
  status: string;
  modelSource?: string | null;
  image?: string | null;
  resourceSpec?: string | null;
  replicas?: number | null;
  runningReplicas?: number | null;
  endpointUrl?: string | null;
  description?: string | null;
  createdAt?: string | null;
}

export interface Storage {
  id: number;
  name: string;
  storageType?: string | null;
  region?: string | null;
  capacityGb?: number | null;
  usedGb?: number | null;
  status?: string | null;
  createdAt?: string | null;
}

export interface ComputeResource {
  id: number;
  name: string;
  gpuModel?: string | null;
  gpuCount?: number | null;
  cpuCores?: number | null;
  memoryGb?: number | null;
  region?: string | null;
  status?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
}

export interface TokenResource {
  id: number;
  name: string;
  modelName?: string | null;
  totalTokens?: number | null;
  usedTokens?: number | null;
  status?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
}

export interface ApiKey {
  id: number;
  name: string;
  keyPrefix?: string | null;
  keyHash?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string | null;
}

export interface ApiKeyCreated extends ApiKey {
  key: string;
}

export interface ImageItem {
  id: number;
  name: string;
  tag?: string | null;
  region?: string | null;
  sizeMb?: number | null;
  source?: string | null;
  description?: string | null;
  createdAt?: string | null;
}

export interface Order {
  id: number;
  orderNo: string;
  itemType?: string | null;
  itemName?: string | null;
  amountFen?: number | null;
  status?: string | null;
  createdAt?: string | null;
}

export interface Bill {
  id: number;
  billNo: string;
  itemType?: string | null;
  amountFen?: number | null;
  direction?: string | null;
  billedAt?: string | null;
}

export interface RepoItem {
  id: number;
  repoType: string;
  name: string;
  description?: string | null;
  visibility?: string | null;
  ownerId?: number | null;
  sizeMb?: number | null;
  downloads?: number | null;
  tags?: string[] | null;
  createdAt?: string | null;
}

export interface Favorite {
  id: number;
  userId?: number | null;
  targetType: string;
  targetId: number;
  item?: RepoItem | null;
  createdAt?: string | null;
}

export interface OverviewCount {
  running: number;
  total: number;
}

export interface Overview {
  notebooks: OverviewCount;
  trainingJobs: OverviewCount;
  inferenceServices: OverviewCount;
  resources: OverviewCount;
  balanceFen: number;
  recentOrders: Order[];
  recentBills: Bill[];
}

export interface Account {
  balanceFen: number;
}
