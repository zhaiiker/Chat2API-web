/**
 * Utils Module - Export all utility functions for tool calling
 */

export * from './tools'
// 新的统一工具解析模块
export * from './toolParser/index'
// 保留旧的 streamToolHandler 以保持向后兼容
// 仅导出 streamToolHandler 中独有的成员，避免与 toolParser/index 重复导出冲突
export {
  ToolCallState,
  createToolCallState,
  processStreamContent,
} from './streamToolHandler'
