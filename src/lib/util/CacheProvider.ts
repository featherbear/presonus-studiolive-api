import type { ZlibPayload } from "../types/ZlibPayload";
import KVTree from "./KVTree";

interface FallbackInterface {
	get(path: string | string[]): any;
}

/**
 * Internal KV State Tree
 * Types do not match transformed
 */
type Node<root> = {
	[key in keyof root]: (root[key] extends { children } ? Node<root[key]["children"]> : Node<root[key]>) &
		(root[key] extends { values } ? { [k in keyof root[key]["values"]]: root[key]["values"][k] } : object);
	// & (root[key] extends { ranges, values} ? { [k in keyof root[key]['values']]: root[key]['values'][k] & root[key]['ranges'][k] } : {})
};

/**
 * Provides a function to set/get paths
 * Delimiter: `.` or `/`
 * @param fallback Fallback method interface that is used if the path could not be found internally
 */
export default function CacheProvider(fallback?: FallbackInterface) {
	const data: KVTree & Node<ZlibPayload["children"]> = new KVTree() as any;

	return {
		set(path: string | string[], value: any) {
			return data.register(path, value);
		},
		get<T = any>(path: string | string[], _default = null): T | typeof _default {
			return data.get(path) ?? fallback?.get(path) ?? _default;
		},
		_data: data,
	};
}
