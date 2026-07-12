import { Router } from 'express';
import {
  getModelNode,
  getSubflow,
  modelNodes,
  subflows,
  topEdges,
  type ModelNode,
  type Subflow,
} from '../data/claimsModel';

const router = Router();

router.get('/claims', (_req, res) => {
  const nodes = Object.keys(modelNodes)
    .map((id) => getModelNode(id))
    .filter((node): node is ModelNode => Boolean(node));

  const subflowList = Object.keys(subflows)
    .map((id) => getSubflow(id))
    .filter((subflow): subflow is Subflow => Boolean(subflow));

  res.json({
    success: true,
    data: {
      nodes,
      subflows: subflowList,
      topEdges,
    },
  });
});

export default router;
