import type { AxiosInstance, AxiosResponse } from 'axios'

export type ListType<T> = {
  data: T[]
  /**
   * Some APIs paginate with offset/length, others with page/length.
   * Keep both optional so children can normalize as needed.
   */
  offset?: number
  page?: number
  length?: number
  total?: number
  [key: string]: any
}

export type Endpoints = {
  base: string | Promise<string>
  byId: (id: string) => string | Promise<string>
  [key: string]: any
}

export default abstract class BaseAPI<T> {
  public baseEndpoint: string | Promise<string>
  public defaultObject: T
  public endpoints: Endpoints

  constructor (baseEndpoint: string | Promise<string>) {
    this.baseEndpoint = baseEndpoint
    this.defaultObject = {} as T
    this.endpoints = {
      base: this.baseEndpoint,
      byId: (id: string) => {
        if (typeof this.endpoints.base === 'string') {
          return `${this.endpoints.base}/${id}`
        }

        return new Promise<string>((resolve, reject) => {
          if (typeof this.endpoints.base !== 'string') {
            this.endpoints.base
              .then((baseEndpoint: string) => resolve(`${baseEndpoint}/${id}`))
              .catch(reject)
          }
        })
      }
    }
  }

  abstract getAxiosInstanceWithToken (): AxiosInstance

  abstract getRawAxiosInstance (): AxiosInstance

  abstract updateAxiosInstanceParamsSerializer (instance: AxiosInstance): void

  abstract getNormalizedListType (response: AxiosResponse<ListType<T>>): ListType<T>

  abstract getNormalizedIndexFilter (filters: Record<string, any>): Record<string, any>

  abstract getNormalizedItem <G> (item: G): G

  normalize<U> (response: Partial<U>, defaultValues: U): U {
    return { ...defaultValues, ...response }
  }

  protected async fetchAndNormalize (id: string): Promise<T> {
    const byIdEndpoint = await this.getByIdEndpoint(id)
    const response = await this.getAxiosInstanceWithToken().get(byIdEndpoint)
    return this.getNormalizedItem(this.normalize(response.data, this.defaultObject))
  }

  async getByIdEndpoint (id: string): Promise<string> {
    return this.endpoints.byId(id)
  }

  async getBaseEndpoint (): Promise<string> {
    if (typeof this.endpoints.base === 'string') {
      return this.endpoints.base
    }

    return await this.endpoints.base
  }

  async index (filters: any = { length: 10 }): Promise<ListType<T>> {
    const baseEndpoint = await this.getBaseEndpoint()
    const response = await this.getAxiosInstanceWithToken()
      .get(baseEndpoint, {
        params: this.getNormalizedIndexFilter(filters)
      })

    const normalizedListType = this.getNormalizedListType(response)
    normalizedListType.data = this.getNormalizedList(normalizedListType.data)

    return normalizedListType
  }

  getNormalizedList <G> (list: G[]): G[] {
    return list.map((item: G) => {
      return this.getNormalizedItem(item)
    })
  }

  async create (data: T | FormData): Promise<number> {
    const baseEndpoint = await this.getBaseEndpoint()
    const response: AxiosResponse<{ id: number }> = await this.getAxiosInstanceWithToken()
    .post(baseEndpoint, data)
    return response.data.id
  }

  async get (id: string, useCache: boolean = true, ttl: number = 1000): Promise<T> {
    const byIdEndpoint = await this.getByIdEndpoint(id)
    const a = this.getAxiosInstanceWithToken()
    const url = byIdEndpoint
    const response = useCache
    // @ts-ignore
      ? await a.getWithCache(url, {
        // Enable caching for this request if `useCache` is true
        useCache,
        cache: {
          ttl
        }
      })
      : await a.get(url)

    return this.getNormalizedItem(this.normalize(response.data, this.defaultObject))
  }

  async update (id: string, data: T | FormData): Promise<void> {
    const byIdEndpoint = await this.getByIdEndpoint(id)
    await this.getAxiosInstanceWithToken().put(byIdEndpoint, data)
  }

  async delete (id: string): Promise<void> {
    const byIdEndpoint = await this.getByIdEndpoint(id)
    await this.getAxiosInstanceWithToken().delete(byIdEndpoint)
  }

  async getAllPagesBaseList (
    indexFilter?: Record<string, any>,
    pageSize = 50
  ): Promise<T[]> {
    try {
      // Fetch the first page to get the total count
      const firstPageResponse = await this.index({
        length: pageSize,
        offset: 0,
        withTotal: true,
        ...(indexFilter ?? {})
      })

      const totalItems = firstPageResponse.total || 0

      // Calculate how many pages are needed
      const totalPages = Math.ceil(totalItems / pageSize)

      // Create an array of promises for each subsequent page
      const pagePromises: Array<Promise<ListType<T>>> = []

      for (let page = 1; page < totalPages; page++) {
        const offset = page * pageSize
        pagePromises.push(this.index({ length: pageSize, offset, withTotal: false }))
      }

      // Await all page promises
      const allPageResponses = await Promise.all(pagePromises)

      // Collect all data into a single array
      return [
        ...firstPageResponse.data,
        ...allPageResponses.flatMap((response) => response.data)
      ] as T[]
    } catch (error) {
      console.error('Error fetching all pages:', error)
      return []
    }
  }

  async getAllPages<M> (
    listApi: (indexFilter?: Record<string, any>) => Promise<ListType<M>>,
    indexFilter?: Record<string, any>,
    pageSize = 50
  ): Promise<M[]> {
    try {
      // Fetch the first page to get the total count
      const firstPageResponse = await listApi({
        length: pageSize,
        offset: 0,
        withTotal: true,
        ...(indexFilter ?? {})
      })

      const totalItems = firstPageResponse.total || 0

      // Calculate how many pages are needed
      const totalPages = Math.ceil(totalItems / pageSize)

      // Create an array of promises for each subsequent page
      const pagePromises: Array<Promise<ListType<M>>> = []

      for (let page = 1; page < totalPages; page++) {
        const offset = page * pageSize
        pagePromises.push(listApi({ length: pageSize, offset, withTotal: false }))
      }

      // Await all page promises
      const allPageResponses = await Promise.all(pagePromises)

      // Collect all data into a single array
      return [
        ...firstPageResponse.data,
        ...allPageResponses.flatMap((response) => response.data)
      ] as M[]
    } catch (error) {
      console.error('Error fetching all pages:', error)
      return []
    }
  }
}

