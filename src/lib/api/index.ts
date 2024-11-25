// src/lib/api/index.ts

import { auth } from './auth';
import { data } from './data';
import { storage } from './storage';

export const api = {
    auth,
    data,
    storage
};