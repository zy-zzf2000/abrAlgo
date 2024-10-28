def sum_qoe_values(log_file):
    total_qoe = 0.0
    recording_started = False
    with open(log_file, 'r') as file:
        for line in file:
            if 'Begin recording' in line:
                recording_started = True
            if 'QoE:' in line and recording_started:
                qoe_value = float(line.split('QoE:')[1].strip())
                total_qoe += qoe_value

    return total_qoe
