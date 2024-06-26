import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch } from '@kubernetes/client-node';

export class  Secrets {
    coreApi:CoreV1Api;
    namespace:string;

    constructor (coreApi: CoreV1Api, namespace:string) {
        this.coreApi=coreApi;
        this.namespace=namespace;
    }

    public write = (name:string, content:{}): Promise<{}> =>{
        return new Promise(
            (resolve, reject) => {
                try {
                    var secret = {
                        metadata: {
                            name: name,
                            namespace: this.namespace
                        },
                        data: content
                    };
                    try {
                        this.coreApi?.replaceNamespacedSecret(name,this.namespace, secret);
                        resolve ({});
                    }
                    catch (err) {
                        this.coreApi?.createNamespacedSecret(this.namespace, secret);
                        resolve ({});
                    }
                }
                catch (err) {
                    reject (undefined);
                }
            }
        );
    }
    
    public read = async (name:string):Promise<{}> =>{
        return new Promise(
            async (resolve,reject) => {
                try {
                    var ct = await this.coreApi?.readNamespacedSecret(name,this.namespace);
                    resolve(ct.body.data!);
                }
                catch(err){
                    reject (undefined);
                }
            }
        );
    }  
}
