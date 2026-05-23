import React from "react";
import { Select, SelectItem } from "@tremor/react";

interface RedisTypeSelectorProps {
  redisType: string;
  redisTypeDescriptions: { [key: string]: string };
  onTypeChange: (type: string) => void;
}

const RedisTypeSelector: React.FC<RedisTypeSelectorProps> = ({ redisType, redisTypeDescriptions, onTypeChange }) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Redis Type</label>
      <Select value={redisType} onValueChange={onTypeChange}>
<SelectItem value="node">节点（单实例）</SelectItem>
         <SelectItem value="cluster">集群</SelectItem>
         <SelectItem value="sentinel">哨兵</SelectItem>
         <SelectItem value="semantic">语义</SelectItem>
      </Select>
      <p className="text-xs text-gray-500">
        {redisTypeDescriptions[redisType] || "Select the type of Redis deployment you're using"}
      </p>
    </div>
  );
};

export default RedisTypeSelector;
