# base-api

An abstract base class for building Axios-powered HTTP services in TypeScript. It cannot be instantiated directly; you must extend and implement the required hooks.

## Install
```bash
# pnpm
pnpm add base-api axios

# npm
npm install base-api axios

# yarn
yarn add base-api axios
```

## Quick start
1) Extend `BaseAPI`.  
2) Implement the abstract methods:  
   `getAxiosInstanceWithToken`, `getRawAxiosInstance`, `updateAxiosInstanceParamsSerializer`, `getNormalizedListType`, `getNormalizedIndexFilter`, `getNormalizedItem`.  
3) Configure endpoints (e.g., `base` and `byId`).

```ts
// api/UserApi.ts
import axios from 'axios'
import { BaseAPI, type ListType } from 'base-api'

type User = { id: number; name: string }

export class UserApi extends BaseAPI<User> {
  constructor () {
    super('/api/users')
    this.defaultObject = { id: 0, name: '' }
  }

  getAxiosInstanceWithToken () {
    const instance = axios.create({
      // example: add auth header
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
    })
    this.updateAxiosInstanceParamsSerializer(instance)
    return instance
  }

  getRawAxiosInstance () {
    const instance = axios.create()
    this.updateAxiosInstanceParamsSerializer(instance)
    return instance
  }

  updateAxiosInstanceParamsSerializer (instance: ReturnType<typeof axios.create>) {
    // apply params serializer or other axios-level config here
  }

  getNormalizedIndexFilter (filters: Record<string, any>) {
    // example: convert page to offset
    if (filters.page != null && filters.length != null) {
      return { ...filters, offset: (filters.page - 1) * filters.length }
    }
    return filters
  }

  getNormalizedListType (response: { data: ListType<User> }): ListType<User> {
    // map/normalize response fields if needed
    return response.data
  }

  getNormalizedItem<G> (item: G): G {
    // normalize individual item if needed
    return item
  }
}
```

### Using the methods
```ts
const userApi = new UserApi()

// list
const list = await userApi.index({ page: 1, length: 20 }) // or offset/length

// fetch one
const user = await userApi.get('123')

// create
const newId = await userApi.create({ name: 'Alice' })

// update
await userApi.update('123', { name: 'Bob' })

// delete
await userApi.delete('123')
```

### Fetch all pages helpers
```ts
// using built-in list method
const allUsers = await userApi.getAllPagesBaseList({ length: 100 })

// or pass a custom list function
const allUsers2 = await userApi.getAllPages(userApi.index.bind(userApi), { length: 100 })
```

## Scripts
```bash
pnpm run build   # build dist with ESM/CJS and d.ts
pnpm run clean   # remove dist
```

## Notes
- `ListType` is open-ended; add your own keys and map them inside `getNormalizedListType`.
- `axios` is a peer dependency; install a compatible version in the consumer project.
- If you rely on custom axios extensions (e.g., `getWithCache`), extend axios types or wrap the instance in your project.

