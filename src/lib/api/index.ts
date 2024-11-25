// src/lib/api/index.ts

import { auth } from './auth';
import { data } from './data';
import { fileStorage } from './storage';
import { fileTree } from "./fileTree.ts";
export const api = {
    auth,
    data,
    fileStorage,
    fileTree
};