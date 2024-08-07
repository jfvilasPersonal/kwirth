import express from 'express';
import { CoreV1Api, AppsV1Api, KubeConfig } from '@kubernetes/client-node';
import Guid from 'guid';

export class ConfigApi {
  public route = express.Router();
  coreApi:CoreV1Api;
  appsV1Api:AppsV1Api;

  constructor (kc:KubeConfig, coreApi:CoreV1Api, appsV1Api:AppsV1Api) {
    this.coreApi=coreApi;
    this.appsV1Api=appsV1Api

    this.route.route('/cluster')
      .get( async (req, res) => {
        try {
          var cluster={ name:kc.getCurrentCluster()?.name, apiKey:Guid.create().toString() };
          res.status(200).json(cluster);
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
    });
    
    // get all namespaces
    this.route.route('/namespaces')
      .get( async (req, res) => {
        try {
          var response = await this.coreApi.listNamespace();
          var namespaces = response.body.items.map (n => n?.metadata?.name);
          res.status(200).json(namespaces);
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
      });

      // get all deployments in a namespace
      this.route.route('/:namespace/sets')
      .get( async (req, res) => {
        try {
          var list:any[]=[];
          var respDeps = await this.appsV1Api.listNamespacedReplicaSet(req.params.namespace);
          list.push (...respDeps.body.items.map (n => { return { name:n?.metadata?.name, type:'replica' }}));
          var respStat = await this.appsV1Api.listNamespacedStatefulSet(req.params.namespace);
          list.push (...respStat.body.items.map (n => { return { name:n?.metadata?.name, type:'stateful' }}));
          var respDae = await this.appsV1Api.listNamespacedDaemonSet(req.params.namespace);
          list.push (...respDae.body.items.map (n => { return { name:n?.metadata?.name, type:'daemon' }}));
          res.status(200).json(list);
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
      });

      // get all pods in a namespace in a set
      this.route.route('/:namespace/:set/pods')
      .get( async (req, res) => {
        try {
          var response= await this.coreApi.listNamespacedPod(req.params.namespace);
          var pods = response.body.items.filter (n => n?.metadata?.ownerReferences![0].name===req.params.set).map (n => n?.metadata?.name);
          res.status(200).json(pods);
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
      });

      this.route.route('/:namespace/:pod/containers')
      .get( async (req, res) => {
        try {
          var response= await this.coreApi.listNamespacedPod(req.params.namespace);
          var searchPod = response.body.items.filter (p => p?.metadata?.name===req.params.pod);
          if (searchPod.length===0) {
            res.status(200).json([]);
            return;
          }
          var conts = searchPod[0].spec?.containers.map(c => c.name);
          res.status(200).json(conts);
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
      });
  }

}
