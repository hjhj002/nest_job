// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title EvidenceStorage
 * @notice 变电站风险事件区块链存证合约
 *
 * 部署后调用 setContractAddress() 将地址写入 .env 中的 RISK_EVIDENCE_CONTRACT_ADDRESS
 */
contract EvidenceStorage {
    struct Evidence {
        string evidenceId;   // 存证唯一ID (UUID)
        string riskEventNo;  // 关联风险事件编号
        string dataHash;     // 存证数据 SHA256 哈希
        string dataType;     // 数据类型: risk_event / alert / strategy_execution
        uint256 timestamp;   // 存证时间戳 (Unix seconds)
        string operator;     // 操作人地址或用户名
    }

    // evidenceId => Evidence
    mapping(string => Evidence) private evidences;

    // 所有存证ID列表（用于遍历）
    string[] private evidenceIds;

    // 存证数量
    uint256 public evidenceCount;

    // 合约管理员
    address public admin;

    // 事件：存证写入成功
    event EvidenceStored(
        string indexed evidenceId,
        string indexed riskEventNo,
        string dataHash,
        uint256 timestamp
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
        evidenceCount = 0;
    }

    /**
     * @notice 写入存证
     * @param _evidenceId  唯一存证ID
     * @param _riskEventNo 关联风险事件编号
     * @param _dataHash    数据哈希
     * @param _dataType    数据类型
     * @param _operator    操作人
     */
    function storeEvidence(
        string memory _evidenceId,
        string memory _riskEventNo,
        string memory _dataHash,
        string memory _dataType,
        string memory _operator
    ) public returns (bool) {
        require(bytes(_evidenceId).length > 0, "evidenceId empty");
        require(bytes(_riskEventNo).length > 0, "riskEventNo empty");
        require(bytes(_dataHash).length > 0, "dataHash empty");
        // 防止重复写入
        require(bytes(evidences[_evidenceId].evidenceId).length == 0, "already exists");

        evidences[_evidenceId] = Evidence({
            evidenceId: _evidenceId,
            riskEventNo: _riskEventNo,
            dataHash: _dataHash,
            dataType: _dataType,
            timestamp: block.timestamp,
            operator: _operator
        });

        evidenceIds.push(_evidenceId);
        evidenceCount = evidenceIds.length;

        emit EvidenceStored(_evidenceId, _riskEventNo, _dataHash, block.timestamp);
        return true;
    }

    /**
     * @notice 查询存证
     */
    function getEvidence(string memory _evidenceId)
        public
        view
        returns (
            string memory evidenceId,
            string memory riskEventNo,
            string memory dataHash,
            string memory dataType,
            uint256 timestamp,
            string memory operator
        )
    {
        Evidence storage e = evidences[_evidenceId];
        require(bytes(e.evidenceId).length > 0, "not found");
        return (e.evidenceId, e.riskEventNo, e.dataHash, e.dataType, e.timestamp, e.operator);
    }

    /**
     * @notice 验证数据哈希是否已存证
     */
    function verifyByHash(string memory _dataHash)
        public
        view
        returns (bool exists, string memory evidenceId, uint256 timestamp)
    {
        for (uint256 i = 0; i < evidenceIds.length; i++) {
            Evidence storage e = evidences[evidenceIds[i]];
            if (keccak256(abi.encodePacked(e.dataHash)) == keccak256(abi.encodePacked(_dataHash))) {
                return (true, e.evidenceId, e.timestamp);
            }
        }
        return (false, "", 0);
    }

    /**
     * @notice 获取所有存证ID
     */
    function getAllEvidenceIds() public view returns (string[] memory) {
        return evidenceIds;
    }

    /**
     * @notice 分页查询存证
     */
    function getEvidencePage(uint256 _offset, uint256 _limit)
        public
        view
        returns (
            string[] memory ids,
            string[] memory riskEventNos,
            string[] memory dataHashes,
            uint256[] memory timestamps
        )
    {
        uint256 total = evidenceIds.length;
        if (_offset >= total) {
            return (new string[](0), new string[](0), new string[](0), new uint256[](0));
        }
        uint256 end = _offset + _limit;
        if (end > total) end = total;
        uint256 size = end - _offset;

        ids = new string[](size);
        riskEventNos = new string[](size);
        dataHashes = new string[](size);
        timestamps = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            Evidence storage e = evidences[evidenceIds[_offset + i]];
            ids[i] = e.evidenceId;
            riskEventNos[i] = e.riskEventNo;
            dataHashes[i] = e.dataHash;
            timestamps[i] = e.timestamp;
        }
    }
}
