export enum ConnectionState {
	error = "error",
	closed = "closed",
	connected = "connected",
	reconnecting = "reconnecting",
	/** Host suspend detected; the socket is presumed dead. */
	sleep = "sleep",
	/** Host resumed; a reconnect is triggered immediately. */
	wake = "wake",
}
