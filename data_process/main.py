'''
Author: zy 953725892@qq.com
Date: 2024-10-21 19:48:59
LastEditors: zy 953725892@qq.com
LastEditTime: 2024-10-22 15:36:23
FilePath: \LoL-plus\data_process\main.py
Description: 

Copyright (c) 2024 by ${git_name_email}, All Rights Reserved. 
'''
from utils import *

log_file_path = r'D:\SourceCode\JS\LoL-plus\results\1729582888814_LOLP_console_log.log'  # 替换为你的日志文件路径
total_qoe_sum = sum_qoe_values(log_file_path)
print(f'Total QoE Sum: {total_qoe_sum}')